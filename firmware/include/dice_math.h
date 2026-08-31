#pragma once

#include <stddef.h>
#include <stdint.h>

// ---------------------------------------------------------------------------
//  Pure, framework-free helpers shared by the RF layer, the DPC tuner and the
//  host protocol. Kept free of Arduino headers so `pio test -e native` can
//  exercise them on the build machine.
// ---------------------------------------------------------------------------

namespace dicemath {

// What a single inventory says about the field.
enum class Verdict : uint8_t {
  Empty = 0,   // nothing answered - field too weak or no dice on the reader
  Single = 1,  // exactly the tag we want
  Multi = 2,   // more than one tag, or a bit-frame collision: field too strong
};

inline Verdict classify(uint8_t tagCount, bool collision, bool truncated, bool targetMatched) {
  if (collision || truncated || tagCount > 1) return Verdict::Multi;
  if (tagCount == 1 && targetMatched) return Verdict::Single;
  return Verdict::Empty;
}

// A standard D6 has opposite faces summing to seven.
inline bool isValidFaceValue(uint8_t value) { return value >= 1 && value <= 6; }
inline uint8_t oppositeFaceValue(uint8_t value) {
  return isValidFaceValue(value) ? (uint8_t)(7 - value) : 0;
}

inline uint8_t clampPercent(int value, uint8_t lo, uint8_t hi) {
  if (value < (int)lo) return lo;
  if (value > (int)hi) return hi;
  return (uint8_t)value;
}

// "04:A2:1B:5C" - colon separated, upper case. Returns characters written.
inline size_t formatUidHex(const uint8_t* bytes, uint8_t len, char* out, size_t outLen) {
  static const char kHex[] = "0123456789ABCDEF";
  size_t pos = 0;
  if (outLen == 0) return 0;
  for (uint8_t i = 0; i < len; ++i) {
    const size_t need = (i ? 3u : 2u) + 1u;  // separator + 2 digits + NUL
    if (pos + need > outLen) break;
    if (i) out[pos++] = ':';
    out[pos++] = kHex[bytes[i] >> 4];
    out[pos++] = kHex[bytes[i] & 0x0F];
  }
  out[pos] = '\0';
  return pos;
}

}  // namespace dicemath
