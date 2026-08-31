#include <unity.h>

#include "dice_math.h"

using dicemath::Verdict;

// Unity ich vola pred a po kazdom teste a linker ich vyzaduje aj prazdne.
// unity.h ich deklaruje v bloku extern "C", takze tu staci obycajna definicia.
void setUp(void) {}
void tearDown(void) {}

void test_collision_always_means_field_too_strong() {
  TEST_ASSERT_EQUAL(Verdict::Multi, dicemath::classify(1, true, false, true));
  TEST_ASSERT_EQUAL(Verdict::Multi, dicemath::classify(3, false, false, false));
  TEST_ASSERT_EQUAL(Verdict::Multi, dicemath::classify(1, false, true, true));
}

void test_single_requires_the_expected_uid() {
  TEST_ASSERT_EQUAL(Verdict::Single, dicemath::classify(1, false, false, true));
  TEST_ASSERT_EQUAL(Verdict::Empty, dicemath::classify(1, false, false, false));
  TEST_ASSERT_EQUAL(Verdict::Empty, dicemath::classify(0, false, false, false));
}

void test_opposite_face_value() {
  TEST_ASSERT_EQUAL_UINT8(6, dicemath::oppositeFaceValue(1));
  TEST_ASSERT_EQUAL_UINT8(1, dicemath::oppositeFaceValue(6));
  TEST_ASSERT_EQUAL_UINT8(4, dicemath::oppositeFaceValue(3));
  TEST_ASSERT_EQUAL_UINT8(0, dicemath::oppositeFaceValue(9));
}

void test_clamp_percent() {
  TEST_ASSERT_EQUAL_UINT8(5, dicemath::clampPercent(-20, 5, 100));
  TEST_ASSERT_EQUAL_UINT8(100, dicemath::clampPercent(140, 5, 100));
  TEST_ASSERT_EQUAL_UINT8(42, dicemath::clampPercent(42, 5, 100));
}

void test_format_uid_hex() {
  const uint8_t uid[7] = {0x04, 0xA2, 0x1B, 0x5C, 0x6D, 0x7E, 0x8F};
  char out[32];
  const size_t written = dicemath::formatUidHex(uid, 7, out, sizeof(out));
  TEST_ASSERT_EQUAL_STRING("04:A2:1B:5C:6D:7E:8F", out);
  TEST_ASSERT_EQUAL_size_t(20, written);
}

void test_format_uid_hex_respects_buffer() {
  const uint8_t uid[7] = {0x04, 0xA2, 0x1B, 0x5C, 0x6D, 0x7E, 0x8F};
  char out[9];
  dicemath::formatUidHex(uid, 7, out, sizeof(out));
  TEST_ASSERT_EQUAL_STRING("04:A2:1B", out);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_collision_always_means_field_too_strong);
  RUN_TEST(test_single_requires_the_expected_uid);
  RUN_TEST(test_opposite_face_value);
  RUN_TEST(test_clamp_percent);
  RUN_TEST(test_format_uid_hex);
  RUN_TEST(test_format_uid_hex_respects_buffer);
  return UNITY_END();
}
