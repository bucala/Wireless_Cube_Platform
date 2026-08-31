#pragma once

#include <stdint.h>

// ---------------------------------------------------------------------------
//  NFC Dice Debugger - build/hardware configuration
//
//  Board  : ESP32-S3-WROOM-1 N16R8
//  Reader : NXP PN5180 (ISO/IEC 14443-A front end) on hardware SPI
//  Tags   : NTAG213, 5 mm inlays cast into a 10 mm dice core
// ---------------------------------------------------------------------------

// --- SPI wiring (FSPI / SPI2_HOST) ----------------------------------------
// Any GPIO can be routed to the SPI peripheral on the S3; the pins below keep
// the strapping pins (0, 3, 45, 46) and the USB pins (19, 20) free.
constexpr int8_t PIN_PN5180_SCK = 12;
constexpr int8_t PIN_PN5180_MISO = 13;
constexpr int8_t PIN_PN5180_MOSI = 11;
constexpr int8_t PIN_PN5180_NSS = 10;
constexpr int8_t PIN_PN5180_BUSY = 9;
constexpr int8_t PIN_PN5180_RST = 8;   // active low
constexpr int8_t PIN_PN5180_IRQ = 7;   // -1 => poll IRQ_STATUS instead

// Optional extras. Set to -1 to disable.
constexpr int8_t PIN_STATUS_LED = 48;  // on-board WS2812 of most S3 devkits
constexpr int8_t PIN_EXT_ATTENUATOR = -1;  // switches a series RF attenuator

// The PN5180 host interface is specified up to 7 MHz.
constexpr uint32_t PN5180_SPI_HZ = 7000000;

// --- RF / scanning behaviour ----------------------------------------------
// One "scan cycle" = one full ISO14443-3A inventory (REQA + anticollision).
constexpr uint32_t SCAN_PERIOD_MS = 60;

// Maximum number of distinct UIDs resolved per inventory. A 10 mm dice can
// present at most 6 tags to the antenna, 8 gives head room for stray tags.
constexpr uint8_t MAX_TAGS_PER_SCAN = 8;

// A UID stays in the "present" set for this long after its last sighting.
// Longer than one scan period so that a single missed frame does not create
// a phantom tag-lost event.
constexpr uint32_t TAG_PRESENCE_TTL_MS = 350;

// --- Dynamic Power Control (DPC) ------------------------------------------
// Field strength is expressed as 0..100 % in the wire protocol and mapped to
// PN5180 TX driver settings by RfPower. 100 % equals the register set that
// LOAD_RF_CONFIG installs from EEPROM for ISO14443-A @106 kbps.
constexpr uint8_t RF_POWER_MIN_PCT = 5;
constexpr uint8_t RF_POWER_MAX_PCT = 100;
constexpr uint8_t RF_POWER_DEFAULT_PCT = 70;

// Auto-tune sweep: start high, walk down in COARSE_STEP, then refine.
constexpr uint8_t DPC_COARSE_STEP_PCT = 5;
constexpr uint8_t DPC_FINE_STEP_PCT = 1;

// Number of consecutive inventories that must agree before a power level is
// accepted. Filters out the occasional dropped frame at the field edge.
constexpr uint8_t DPC_SAMPLES_PER_STEP = 6;
constexpr uint8_t DPC_MIN_HITS_FOR_STABLE = 5;

// Safety margin added on top of the lowest power level that still reads the
// bottom tag reliably, so that mechanical tolerances do not break reading.
constexpr uint8_t DPC_HEADROOM_PCT = 3;

// --- Networking -----------------------------------------------------------
constexpr uint16_t HTTP_PORT = 80;
constexpr char WS_PATH[] = "/ws";
constexpr char MDNS_HOSTNAME[] = "nfc-dice";       // -> http://nfc-dice.local
constexpr char AP_SSID[] = "NFC-Dice-Debugger";    // STA fallback
constexpr char AP_PASS[] = "dice1234";             // >= 8 chars
constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 12000;

// Telemetry push interval for the "state" frame (heartbeat + counters).
constexpr uint32_t STATE_PUSH_PERIOD_MS = 1000;

// Firmware identity reported in the hello frame.
constexpr char FW_NAME[] = "nfc-dice-debugger";
constexpr char FW_VERSION[] = "1.0.0";
constexpr char PROTOCOL_VERSION[] = "1";
