#include "Iso14443a.h"

#include <Arduino.h>

#include "dice_math.h"

using namespace pn5180;

namespace {

constexpr uint32_t REQA_TIMEOUT_MS = 6;
constexpr uint32_t ANTICOLL_TIMEOUT_MS = 12;

// The PN5180 hands the anticollision answer back starting at bit 0 of the first
// received byte, i.e. it does not pre-align the response with the bits we
// already knew. If you port this to a front end that aligns the response with
// the transmitted partial byte (MFRC522 style "rxAlign"), flip this flag.
constexpr bool RX_ALIGNED_TO_KNOWN_BITS = false;

inline bool bitGet(const uint8_t* buf, uint16_t bitIndex) {
  return (buf[bitIndex >> 3] >> (bitIndex & 0x07)) & 0x01;
}

inline void bitSet(uint8_t* buf, uint16_t bitIndex, bool value) {
  const uint8_t mask = (uint8_t)(1u << (bitIndex & 0x07));
  if (value)
    buf[bitIndex >> 3] |= mask;
  else
    buf[bitIndex >> 3] &= (uint8_t)~mask;
}

// Copies `bitCount` bits out of `src` (LSB first inside each byte, which is the
// order ISO14443-A transmits and the PN5180 buffers them in) into `dst`
// starting at bit offset `dstBitOffset`.
void mergeBits(uint8_t* dst, uint16_t dstBitOffset, const uint8_t* src, uint16_t srcBitOffset,
               uint16_t bitCount) {
  for (uint16_t i = 0; i < bitCount; ++i)
    bitSet(dst, dstBitOffset + i, bitGet(src, srcBitOffset + i));
}

}  // namespace

void TagUid::toHex(char* out, size_t outLen) const {
  dicemath::formatUidHex(bytes, len, out, outLen);
}

bool Iso14443a::begin() {
  if (!reader_.loadRfConfig(RF_TX_ISO14443A_106, RF_RX_ISO14443A_106)) {
    lastError_ = "LOAD_RF_CONFIG failed";
    return false;
  }
  if (!reader_.rfOn()) {
    lastError_ = "RF_ON failed";
    return false;
  }
  return true;
}

bool Iso14443a::fieldOn() {
  // LOAD_RF_CONFIG must be repeated after a field cycle: it restores the
  // protocol register set (and the TX baseline that RfPower then trims).
  if (!reader_.loadRfConfig(RF_TX_ISO14443A_106, RF_RX_ISO14443A_106)) return false;
  return reader_.rfOn();
}

bool Iso14443a::fieldOff() { return reader_.rfOff(); }

bool Iso14443a::prepareTransceive(bool withCrc) {
  // REQA and the anticollision frames are sent without CRC; SELECT and HALT
  // carry one.
  if (withCrc) {
    if (!reader_.writeRegisterOrMask(REG_CRC_TX_CONFIG, 0x01)) return false;
    if (!reader_.writeRegisterOrMask(REG_CRC_RX_CONFIG, 0x01)) return false;
  } else {
    if (!reader_.writeRegisterAndMask(REG_CRC_TX_CONFIG, ~0x01u)) return false;
    if (!reader_.writeRegisterAndMask(REG_CRC_RX_CONFIG, ~0x01u)) return false;
  }
  return reader_.clearIrq(IRQ_ALL);
}

bool Iso14443a::transceive(const uint8_t* tx, uint8_t txLen, uint8_t txValidBits, uint8_t* rx,
                           uint16_t rxCap, uint16_t& rxBytes, uint8_t& rxLastBits,
                           bool& collision, uint32_t timeoutMs) {
  rxBytes = 0;
  rxLastBits = 0;
  collision = false;

  if (!reader_.sendData(tx, txLen, txValidBits)) {
    lastError_ = reader_.lastError();
    return false;
  }
  if (!reader_.waitForIrq(IRQ_RX | IRQ_GENERAL_ERROR, timeoutMs)) {
    // No answer at all - normal when the field reaches no tag.
    return false;
  }

  uint32_t rxStatus = 0;
  if (!reader_.readRxStatus(rxStatus)) {
    lastError_ = "RX_STATUS read failed";
    return false;
  }
  collision = rxCollision(rxStatus);
  rxLastBits = pn5180::rxLastBits(rxStatus);
  uint16_t available = rxNumBytes(rxStatus);
  if (available == 0) return collision;  // collision inside the very first bit

  if (available > rxCap) {
    available = rxCap;
    lastError_ = "RX buffer too small";
  }
  if (!reader_.readData(rx, available)) {
    lastError_ = "READ_DATA failed";
    return false;
  }
  rxBytes = available;
  return true;
}

bool Iso14443a::requestA(bool wakeHalted, uint8_t atqa[2], bool& collision, bool& anyAnswer) {
  if (!prepareTransceive(false)) return false;

  const uint8_t cmd = wakeHalted ? ISO14443_WUPA : ISO14443_REQA;
  uint8_t rx[4] = {0};
  uint16_t rxBytes = 0;
  uint8_t rxLastBits = 0;

  // REQA/WUPA are 7-bit short frames.
  const bool ok = transceive(&cmd, 1, 7, rx, sizeof(rx), rxBytes, rxLastBits, collision,
                             REQA_TIMEOUT_MS);
  anyAnswer = ok && (rxBytes > 0 || collision);
  if (rxBytes >= 2) {
    atqa[0] = rx[0];
    atqa[1] = rx[1];
  }
  return anyAnswer;
}

// One cascade level of the bit-frame anticollision loop. On return `uidCl`
// holds the 4 UID bytes + BCC of this level.
bool Iso14443a::selectCascadeLevel(uint8_t selCode, uint8_t uidCl[5], uint8_t& sak,
                                   bool& collision, bool& cascade) {
  uint8_t known[5] = {0};   // UID bytes of this cascade level + BCC, bit packed
  uint16_t knownBits = 0;   // how many of the 40 bits we already resolved
  collision = false;
  cascade = false;

  for (uint8_t guard = 0; guard < 40; ++guard) {
    if (!prepareTransceive(false)) return false;

    const uint8_t knownBytes = (uint8_t)((knownBits + 7) / 8);
    const uint8_t partialBits = (uint8_t)(knownBits % 8);

    uint8_t tx[9] = {0};
    tx[0] = selCode;
    // NVB: high nibble = number of valid bytes in the frame (incl. SEL+NVB),
    // low nibble = number of valid bits in the trailing partial byte.
    tx[1] = (uint8_t)(((2 + (knownBits / 8)) << 4) | partialBits);
    memcpy(&tx[2], known, knownBytes);
    const uint8_t txLen = (uint8_t)(2 + knownBytes);

    uint8_t rx[8] = {0};
    uint16_t rxBytes = 0;
    uint8_t rxLastBits = 0;
    bool frameCollision = false;

    const bool ok = transceive(tx, txLen, partialBits, rx, sizeof(rx), rxBytes, rxLastBits,
                               frameCollision, ANTICOLL_TIMEOUT_MS);

    if (frameCollision) {
      collision = true;
      uint32_t rxStatus = 0;
      reader_.readRxStatus(rxStatus);
      uint16_t collisionBit = rxCollisionPos(rxStatus);
      if (collisionBit == 0) collisionBit = 1;  // treat "unknown" as the next bit

      const uint16_t absoluteBit = (uint16_t)(knownBits + collisionBit - 1);
      if (absoluteBit >= 40) {
        lastError_ = "collision position out of range";
        return false;
      }
      // Merge everything the tags agreed on, then pick the '0' branch of the
      // colliding bit. The tag on the other branch answers the next round.
      if (rxBytes > 0) {
        const uint16_t agreedBits = (uint16_t)(absoluteBit - knownBits);
        mergeBits(known, knownBits, rx, RX_ALIGNED_TO_KNOWN_BITS ? knownBits % 8 : 0,
                  agreedBits);
      }
      bitSet(known, absoluteBit, false);
      knownBits = (uint16_t)(absoluteBit + 1);
      continue;
    }

    if (!ok || rxBytes == 0) {
      lastError_ = "no answer to anticollision frame";
      return false;
    }

    // Complete answer: the remaining UID bits + BCC.
    const uint16_t receivedBits =
        (uint16_t)(rxBytes * 8 - (rxLastBits ? (8 - rxLastBits) : 0));
    mergeBits(known, knownBits, rx, RX_ALIGNED_TO_KNOWN_BITS ? knownBits % 8 : 0,
              receivedBits);
    knownBits = 40;

    // BCC check: XOR of the four UID bytes.
    const uint8_t bcc = (uint8_t)(known[0] ^ known[1] ^ known[2] ^ known[3]);
    if (bcc != known[4]) {
      lastError_ = "BCC mismatch";
      return false;
    }

    // SELECT: full 7 byte frame with CRC, answered by the SAK.
    if (!prepareTransceive(true)) return false;
    uint8_t sel[7] = {selCode, 0x70, known[0], known[1], known[2], known[3], known[4]};
    uint8_t sakBuf[3] = {0};
    uint16_t sakLen = 0;
    uint8_t sakLastBits = 0;
    bool selCollision = false;
    if (!transceive(sel, sizeof(sel), 0, sakBuf, sizeof(sakBuf), sakLen, sakLastBits,
                    selCollision, ANTICOLL_TIMEOUT_MS) ||
        sakLen < 1) {
      lastError_ = "SELECT not acknowledged";
      return false;
    }

    memcpy(uidCl, known, 5);
    sak = sakBuf[0];
    cascade = (sak & 0x04) != 0;  // bit 3 set => UID continues in the next level
    return true;
  }

  lastError_ = "anticollision did not converge";
  return false;
}

bool Iso14443a::resolveOneUid(TagUid& uid, bool& collision) {
  static const uint8_t kSelCodes[3] = {ISO14443_ANTICOLL_CL1, ISO14443_ANTICOLL_CL2,
                                       ISO14443_ANTICOLL_CL3};
  uid = TagUid{};
  collision = false;

  for (uint8_t level = 0; level < 3; ++level) {
    uint8_t uidCl[5] = {0};
    uint8_t sak = 0;
    bool cascade = false;
    bool levelCollision = false;

    if (!selectCascadeLevel(kSelCodes[level], uidCl, sak, levelCollision, cascade)) {
      collision = collision || levelCollision;
      return false;
    }
    collision = collision || levelCollision;

    if (cascade) {
      // First byte is the cascade tag (0x88), the remaining three are UID bytes.
      if (uidCl[0] != ISO14443_CT) lastError_ = "missing cascade tag";
      for (uint8_t i = 1; i < 4; ++i) uid.bytes[uid.len++] = uidCl[i];
    } else {
      for (uint8_t i = 0; i < 4; ++i) uid.bytes[uid.len++] = uidCl[i];
      uid.sak = sak;
      return true;
    }
  }
  lastError_ = "UID longer than 10 bytes";
  return false;
}

bool Iso14443a::halt() {
  if (!prepareTransceive(true)) return false;
  const uint8_t cmd[2] = {0x50, 0x00};
  uint8_t rx[2] = {0};
  uint16_t rxBytes = 0;
  uint8_t rxLastBits = 0;
  bool collision = false;
  // A compliant PICC stays silent after HALT, so "no answer" is success here.
  transceive(cmd, sizeof(cmd), 0, rx, sizeof(rx), rxBytes, rxLastBits, collision, 4);
  return true;
}

bool Iso14443a::inventory(InventoryResult& out, uint8_t maxTags) {
  const uint32_t start = micros();
  out = InventoryResult{};
  if (maxTags > MAX_TAGS_PER_SCAN) maxTags = MAX_TAGS_PER_SCAN;

  bool wakeHalted = false;  // first round REQA, later rounds WUPA is not needed
  for (uint8_t round = 0; round < maxTags; ++round) {
    uint8_t atqa[2] = {0};
    bool reqCollision = false;
    bool answered = false;
    requestA(wakeHalted, atqa, reqCollision, answered);
    out.collisionSeen = out.collisionSeen || reqCollision;

    if (!answered) break;  // field is empty (or everything already halted)

    TagUid uid;
    bool uidCollision = false;
    if (!resolveOneUid(uid, uidCollision)) {
      out.collisionSeen = out.collisionSeen || uidCollision;
      // A failed resolution still means at least one tag was in the field.
      break;
    }
    out.collisionSeen = out.collisionSeen || uidCollision;

    bool duplicate = false;
    for (uint8_t i = 0; i < out.count; ++i)
      if (out.tags[i] == uid) duplicate = true;

    if (!duplicate) {
      if (out.count >= maxTags) {
        out.truncated = true;
        break;
      }
      out.tags[out.count++] = uid;
    }

    // Silence this tag so the next REQA only reaches the others.
    halt();
  }

  out.agc = reader_.agcValue();
  out.durationUs = micros() - start;
  return true;
}
