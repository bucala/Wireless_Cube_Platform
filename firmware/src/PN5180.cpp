#include "PN5180.h"

using namespace pn5180;

namespace {
constexpr uint32_t BUSY_TIMEOUT_MS = 60;
}

PN5180::PN5180(int8_t nss, int8_t busy, int8_t rst, SPIClass& spi)
    : nss_(nss), busy_(busy), rst_(rst), spi_(spi), settings_(7000000, MSBFIRST, SPI_MODE0) {}

bool PN5180::begin(int8_t sck, int8_t miso, int8_t mosi, uint32_t clockHz) {
  settings_ = SPISettings(clockHz, MSBFIRST, SPI_MODE0);

  pinMode(nss_, OUTPUT);
  digitalWrite(nss_, HIGH);
  pinMode(busy_, INPUT);
  pinMode(rst_, OUTPUT);
  digitalWrite(rst_, HIGH);

  spi_.begin(sck, miso, mosi, -1);  // CS handled manually

  hardReset();

  // READ_EEPROM of the version block doubles as a presence check: a missing or
  // mis-wired front end answers 0x00/0xFF for every byte.
  uint8_t version[4] = {0};
  if (!readEeprom(0x10, version, 4)) {
    fail("EEPROM read failed - check SPI wiring / BUSY line");
    return false;
  }
  productVersion_ = (uint32_t)version[1] << 8 | version[0];
  firmwareVersion_ = (uint32_t)version[3] << 8 | version[2];
  if (productVersion_ == 0x0000 || productVersion_ == 0xFFFF) {
    fail("PN5180 not responding (product version invalid)");
    return false;
  }
  return true;
}

void PN5180::hardReset() {
  digitalWrite(rst_, LOW);
  delay(10);
  digitalWrite(rst_, HIGH);
  delay(10);
  // After a reset the front end raises IDLE; consume it so the first
  // transceive does not see a stale IRQ.
  waitBusy(LOW, BUSY_TIMEOUT_MS);
  clearIrq(IRQ_ALL);
}

bool PN5180::waitBusy(bool level, uint32_t timeoutMs) {
  const uint32_t deadline = millis() + timeoutMs;
  while (digitalRead(busy_) != (level ? HIGH : LOW)) {
    if ((int32_t)(millis() - deadline) >= 0) {
      fail(level ? "timeout waiting for BUSY high" : "timeout waiting for BUSY low");
      return false;
    }
    delayMicroseconds(20);
  }
  return true;
}

bool PN5180::transceiveCommand(const uint8_t* send, size_t sendLen, uint8_t* recv,
                               size_t recvLen) {
  if (!waitBusy(LOW, BUSY_TIMEOUT_MS)) return false;

  spi_.beginTransaction(settings_);
  digitalWrite(nss_, LOW);
  delayMicroseconds(2);
  for (size_t i = 0; i < sendLen; ++i) spi_.transfer(send[i]);
  if (!waitBusy(HIGH, BUSY_TIMEOUT_MS)) {
    digitalWrite(nss_, HIGH);
    spi_.endTransaction();
    return false;
  }
  digitalWrite(nss_, HIGH);
  spi_.endTransaction();
  if (!waitBusy(LOW, BUSY_TIMEOUT_MS)) return false;

  if (recv == nullptr || recvLen == 0) return true;

  spi_.beginTransaction(settings_);
  digitalWrite(nss_, LOW);
  delayMicroseconds(2);
  for (size_t i = 0; i < recvLen; ++i) recv[i] = spi_.transfer(0xFF);
  if (!waitBusy(HIGH, BUSY_TIMEOUT_MS)) {
    digitalWrite(nss_, HIGH);
    spi_.endTransaction();
    return false;
  }
  digitalWrite(nss_, HIGH);
  spi_.endTransaction();
  return waitBusy(LOW, BUSY_TIMEOUT_MS);
}

// --- register access -------------------------------------------------------

bool PN5180::writeRegister(uint8_t reg, uint32_t value) {
  const uint8_t frame[6] = {CMD_WRITE_REGISTER,
                            reg,
                            (uint8_t)(value & 0xFF),
                            (uint8_t)((value >> 8) & 0xFF),
                            (uint8_t)((value >> 16) & 0xFF),
                            (uint8_t)((value >> 24) & 0xFF)};
  return transceiveCommand(frame, sizeof(frame), nullptr, 0);
}

bool PN5180::writeRegisterOrMask(uint8_t reg, uint32_t orMask) {
  const uint8_t frame[6] = {CMD_WRITE_REGISTER_OR_MASK,
                            reg,
                            (uint8_t)(orMask & 0xFF),
                            (uint8_t)((orMask >> 8) & 0xFF),
                            (uint8_t)((orMask >> 16) & 0xFF),
                            (uint8_t)((orMask >> 24) & 0xFF)};
  return transceiveCommand(frame, sizeof(frame), nullptr, 0);
}

bool PN5180::writeRegisterAndMask(uint8_t reg, uint32_t andMask) {
  const uint8_t frame[6] = {CMD_WRITE_REGISTER_AND_MASK,
                            reg,
                            (uint8_t)(andMask & 0xFF),
                            (uint8_t)((andMask >> 8) & 0xFF),
                            (uint8_t)((andMask >> 16) & 0xFF),
                            (uint8_t)((andMask >> 24) & 0xFF)};
  return transceiveCommand(frame, sizeof(frame), nullptr, 0);
}

bool PN5180::readRegister(uint8_t reg, uint32_t& value) {
  const uint8_t frame[2] = {CMD_READ_REGISTER, reg};
  uint8_t rx[4] = {0};
  if (!transceiveCommand(frame, sizeof(frame), rx, sizeof(rx))) return false;
  value = (uint32_t)rx[0] | ((uint32_t)rx[1] << 8) | ((uint32_t)rx[2] << 16) |
          ((uint32_t)rx[3] << 24);
  return true;
}

bool PN5180::updateRegisterField(uint8_t reg, uint32_t mask, uint8_t shift, uint32_t value) {
  uint32_t current = 0;
  if (!readRegister(reg, current)) return false;
  const uint32_t updated = (current & ~mask) | ((value << shift) & mask);
  if (updated == current) return true;
  return writeRegister(reg, updated);
}

bool PN5180::readEeprom(uint8_t addr, uint8_t* buf, uint8_t len) {
  const uint8_t frame[3] = {CMD_READ_EEPROM, addr, len};
  return transceiveCommand(frame, sizeof(frame), buf, len);
}

// --- RF plumbing -----------------------------------------------------------

bool PN5180::loadRfConfig(uint8_t txConfig, uint8_t rxConfig) {
  const uint8_t frame[3] = {CMD_LOAD_RF_CONFIG, txConfig, rxConfig};
  return transceiveCommand(frame, sizeof(frame), nullptr, 0);
}

bool PN5180::rfOn() {
  const uint8_t frame[2] = {CMD_RF_ON, 0x00};
  if (!transceiveCommand(frame, sizeof(frame), nullptr, 0)) return false;
  return waitForIrq(IRQ_TX_RFON, 20);
}

bool PN5180::rfOff() {
  const uint8_t frame[2] = {CMD_RF_OFF, 0x00};
  if (!transceiveCommand(frame, sizeof(frame), nullptr, 0)) return false;
  return waitForIrq(IRQ_TX_RFOFF, 20);
}

bool PN5180::isRfOn() {
  uint32_t rfStatus = 0;
  if (!readRegister(REG_RF_STATUS, rfStatus)) return false;
  return txRfOn(rfStatus);
}

bool PN5180::setTransceiveCommand(uint32_t command) {
  if (!writeRegisterAndMask(REG_SYSTEM_CONFIG, ~SYSTEM_CONFIG_COMMAND_MASK)) return false;
  return writeRegisterOrMask(REG_SYSTEM_CONFIG, command & SYSTEM_CONFIG_COMMAND_MASK);
}

uint8_t PN5180::transceiveState() {
  uint32_t rfStatus = 0;
  if (!readRegister(REG_RF_STATUS, rfStatus)) return 0xFF;
  return pn5180::transceiveState(rfStatus);
}

bool PN5180::sendData(const uint8_t* data, uint8_t len, uint8_t validBits) {
  if (len > 260) {
    fail("frame too long");
    return false;
  }
  // The front end only accepts SEND_DATA while it waits for a transmission.
  if (!setTransceiveCommand(TRANSCEIVE_CMD_IDLE)) return false;
  if (!setTransceiveCommand(TRANSCEIVE_CMD_TRANSCEIVE)) return false;
  if (transceiveState() != TS_WAIT_TRANSMIT) {
    fail("transceiver not in WAIT_TRANSMIT");
    return false;
  }

  uint8_t frame[2 + 260];
  frame[0] = CMD_SEND_DATA;
  frame[1] = validBits;  // 0 => full bytes
  memcpy(&frame[2], data, len);
  return transceiveCommand(frame, 2 + len, nullptr, 0);
}

bool PN5180::readData(uint8_t* buf, uint16_t len) {
  if (len > 508) {
    fail("read too long");
    return false;
  }
  const uint8_t frame[2] = {CMD_READ_DATA, 0x00};
  return transceiveCommand(frame, sizeof(frame), buf, len);
}

uint32_t PN5180::irqStatus() {
  uint32_t status = 0;
  readRegister(REG_IRQ_STATUS, status);
  return status;
}

bool PN5180::clearIrq(uint32_t mask) { return writeRegister(REG_IRQ_CLEAR, mask); }

bool PN5180::waitForIrq(uint32_t mask, uint32_t timeoutMs) {
  const uint32_t deadline = millis() + timeoutMs;
  while ((int32_t)(millis() - deadline) < 0) {
    if (irqStatus() & mask) return true;
    delayMicroseconds(150);
  }
  fail("IRQ timeout");
  return false;
}

bool PN5180::readRxStatus(uint32_t& rxStatus) { return readRegister(REG_RX_STATUS, rxStatus); }

uint16_t PN5180::agcValue() {
  uint32_t value = 0;
  if (readRegister(REG_AGC_VALUE, value)) return value & 0x03FFu;
  uint32_t rfStatus = 0;
  if (readRegister(REG_RF_STATUS, rfStatus)) return agcFromRfStatus(rfStatus);
  return 0;
}
