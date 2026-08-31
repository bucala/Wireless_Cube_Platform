#pragma once

#include <stdint.h>

#include "PN5180.h"
#include "config.h"

// ---------------------------------------------------------------------------
//  ISO/IEC 14443-3 type A inventory on top of the PN5180.
//
//  The dice debugger needs more than "read one card": it has to know how many
//  tags the field currently reaches, because that count is the feedback signal
//  for the power tuner. The inventory therefore runs the full bit-frame
//  anticollision loop and HALTs every tag it resolved, so the next REQA only
//  wakes the tags that have not been enumerated yet.
// ---------------------------------------------------------------------------

struct TagUid {
  uint8_t bytes[10] = {0};
  uint8_t len = 0;
  uint8_t sak = 0;

  bool operator==(const TagUid& other) const {
    if (len != other.len) return false;
    for (uint8_t i = 0; i < len; ++i)
      if (bytes[i] != other.bytes[i]) return false;
    return true;
  }

  // Writes "04:A2:1B:5C:6D:7E:8F" into `out` (needs 3*len bytes).
  void toHex(char* out, size_t outLen) const;
};

struct InventoryResult {
  TagUid tags[MAX_TAGS_PER_SCAN];
  uint8_t count = 0;
  bool collisionSeen = false;   // bit-frame collision reported by the front end
  bool truncated = false;       // more tags present than MAX_TAGS_PER_SCAN
  uint16_t agc = 0;             // receiver gain during the inventory
  uint32_t durationUs = 0;
};

class Iso14443a {
 public:
  explicit Iso14443a(PN5180& reader) : reader_(reader) {}

  // Loads the ISO14443-A 106 kbit/s configuration and switches the field on.
  bool begin();
  bool fieldOn();
  bool fieldOff();

  // One full inventory cycle.
  bool inventory(InventoryResult& out, uint8_t maxTags = MAX_TAGS_PER_SCAN);

  const char* lastError() const { return lastError_; }

 private:
  bool prepareTransceive(bool withCrc);
  bool transceive(const uint8_t* tx, uint8_t txLen, uint8_t txValidBits, uint8_t* rx,
                  uint16_t rxCap, uint16_t& rxBytes, uint8_t& rxLastBits, bool& collision,
                  uint32_t timeoutMs);

  bool requestA(bool wakeHalted, uint8_t atqa[2], bool& collision, bool& anyAnswer);
  bool resolveOneUid(TagUid& uid, bool& collision);
  bool selectCascadeLevel(uint8_t selCode, uint8_t uidCl[5], uint8_t& sak, bool& collision,
                          bool& cascade);
  bool halt();

  PN5180& reader_;
  const char* lastError_ = "";
};
