#pragma once

#include <stdint.h>

// ---------------------------------------------------------------------------
//  PN5180 host interface constants.
//
//  Bit positions follow the NXP PN5180A0xx/C1/C2 product data sheet
//  (Rev. 3.x, "Register overview" and "Host Interface Command" chapters).
//  Silicon revisions share the command set; if you port this to a different
//  front end, this header is the only place that needs to change.
// ---------------------------------------------------------------------------

namespace pn5180 {

// --- Host interface commands ---------------------------------------------
enum Command : uint8_t {
  CMD_WRITE_REGISTER = 0x00,
  CMD_WRITE_REGISTER_OR_MASK = 0x01,
  CMD_WRITE_REGISTER_AND_MASK = 0x02,
  CMD_WRITE_REGISTER_MULTIPLE = 0x03,
  CMD_READ_REGISTER = 0x04,
  CMD_READ_REGISTER_MULTIPLE = 0x05,
  CMD_WRITE_EEPROM = 0x06,
  CMD_READ_EEPROM = 0x07,
  CMD_WRITE_TX_DATA = 0x08,
  CMD_SEND_DATA = 0x09,
  CMD_READ_DATA = 0x0A,
  CMD_SWITCH_MODE = 0x0B,
  CMD_MIFARE_AUTHENTICATE = 0x0C,
  CMD_EPC_INVENTORY = 0x0D,
  CMD_EPC_RESUME_INVENTORY = 0x0E,
  CMD_EPC_RETRIEVE_INVENTORY_RESULT_SIZE = 0x0F,
  CMD_EPC_RETRIEVE_INVENTORY_RESULT = 0x10,
  CMD_LOAD_RF_CONFIG = 0x11,
  CMD_UPDATE_RF_CONFIG = 0x12,
  CMD_RETRIEVE_RF_CONFIG_SIZE = 0x13,
  CMD_RETRIEVE_RF_CONFIG = 0x14,
  CMD_RF_ON = 0x16,
  CMD_RF_OFF = 0x17,
};

// --- Registers ------------------------------------------------------------
enum Register : uint8_t {
  REG_SYSTEM_CONFIG = 0x00,
  REG_IRQ_ENABLE = 0x01,
  REG_IRQ_STATUS = 0x02,
  REG_IRQ_CLEAR = 0x03,
  REG_TRANSCEIVE_CONTROL = 0x04,
  REG_TIMER1_RELOAD = 0x0C,
  REG_TIMER1_CONFIG = 0x0F,
  REG_RX_WAIT_CONFIG = 0x11,
  REG_CRC_RX_CONFIG = 0x12,
  REG_RX_STATUS = 0x13,
  REG_TX_UNDERSHOOT_CONFIG = 0x14,
  REG_TX_OVERSHOOT_CONFIG = 0x15,
  REG_TX_DATA_MOD = 0x16,
  REG_TX_WAIT_CONFIG = 0x17,
  REG_TX_CONFIG = 0x18,
  REG_CRC_TX_CONFIG = 0x19,
  REG_SIGPRO_CONFIG = 0x1A,
  REG_SIGPRO_CM_CONFIG = 0x1B,
  REG_SIGPRO_RM_CONFIG = 0x1C,
  REG_RF_STATUS = 0x1D,
  REG_AGC_CONFIG = 0x1E,
  REG_AGC_VALUE = 0x1F,
  REG_RF_CONTROL_TX = 0x20,
  REG_RF_CONTROL_TX_CLK = 0x21,
  REG_RF_CONTROL_RX = 0x22,
  REG_LD_CONTROL = 0x23,
  REG_SYSTEM_STATUS = 0x24,
  REG_TEMP_CONTROL = 0x25,
  REG_AGC_REF_CONFIG = 0x26,
};

// --- SYSTEM_CONFIG (0x00) -------------------------------------------------
// COMMAND field, bits [2:0]: state machine of the RF transceiver.
constexpr uint32_t SYSTEM_CONFIG_COMMAND_MASK = 0x00000007u;
enum TransceiveCommand : uint32_t {
  TRANSCEIVE_CMD_IDLE = 0x0,
  TRANSCEIVE_CMD_TRANSMIT = 0x1,
  TRANSCEIVE_CMD_RECEIVE = 0x2,
  TRANSCEIVE_CMD_TRANSCEIVE = 0x3,
  TRANSCEIVE_CMD_LOOPBACK = 0x4,
};

// --- IRQ_STATUS (0x02) ----------------------------------------------------
constexpr uint32_t IRQ_RX = 1u << 0;             // data received
constexpr uint32_t IRQ_TX = 1u << 1;             // data transmitted
constexpr uint32_t IRQ_IDLE = 1u << 2;
constexpr uint32_t IRQ_MODE_DETECTED = 1u << 3;
constexpr uint32_t IRQ_CARD_ACTIVATED = 1u << 4;
constexpr uint32_t IRQ_STATE_CHANGE = 1u << 5;
constexpr uint32_t IRQ_RFOFF_DET = 1u << 6;
constexpr uint32_t IRQ_RFON_DET = 1u << 7;
constexpr uint32_t IRQ_TX_RFOFF = 1u << 8;
constexpr uint32_t IRQ_TX_RFON = 1u << 9;
constexpr uint32_t IRQ_RF_ACTIVE_ERROR = 1u << 10;
constexpr uint32_t IRQ_TIMER0 = 1u << 11;
constexpr uint32_t IRQ_TIMER1 = 1u << 12;
constexpr uint32_t IRQ_TIMER2 = 1u << 13;
constexpr uint32_t IRQ_RX_SOF_DET = 1u << 14;
constexpr uint32_t IRQ_RX_SC_DET = 1u << 15;
constexpr uint32_t IRQ_GENERAL_ERROR = 1u << 17;
constexpr uint32_t IRQ_ALL = 0x000FFFFFu;

// --- RX_STATUS (0x13) -----------------------------------------------------
// RX_NUM_BYTES_RECEIVED [8:0], RX_NUM_LAST_BITS [11:9],
// RX_COLLISION_POS [23:19], RX_COLLISION_DETECTED [18].
inline uint16_t rxNumBytes(uint32_t rxStatus) { return rxStatus & 0x000001FFu; }
inline uint8_t rxLastBits(uint32_t rxStatus) { return (rxStatus >> 9) & 0x07u; }
inline bool rxCollision(uint32_t rxStatus) { return (rxStatus & (1u << 18)) != 0; }
inline uint8_t rxCollisionPos(uint32_t rxStatus) { return (rxStatus >> 19) & 0x3Fu; }

// --- RF_STATUS (0x1D) -----------------------------------------------------
// TRANSCEIVE_STATE [26:24], CRC_OK [19], DPLL_ENABLE [18], RF_DET_STATUS [17],
// TX_RF_STATUS [16], AGC_VALUE [9:0] mirrors the receiver gain.
inline uint8_t transceiveState(uint32_t rfStatus) { return (rfStatus >> 24) & 0x07u; }
inline bool txRfOn(uint32_t rfStatus) { return (rfStatus & (1u << 16)) != 0; }
inline bool rfFieldDetected(uint32_t rfStatus) { return (rfStatus & (1u << 17)) != 0; }
inline uint16_t agcFromRfStatus(uint32_t rfStatus) { return rfStatus & 0x03FFu; }

enum TransceiveState : uint8_t {
  TS_IDLE = 0,
  TS_WAIT_TRANSMIT = 1,
  TS_TRANSMITTING = 2,
  TS_WAIT_RECEIVE = 3,
  TS_WAIT_FOR_DATA = 4,
  TS_RECEIVING = 5,
  TS_LOOPBACK = 6,
};

// --- RF_CONTROL_TX (0x20) -------------------------------------------------
// The analog TX front end. LOAD_RF_CONFIG copies a protocol-specific default
// into this register from EEPROM; writing it afterwards is the documented way
// to trim the emitted field without re-loading a whole configuration set.
//
//   TX_RESIDUAL_CARRIER [4:0]  residual carrier during modulation (in %)
//   TX_CW_AMPLITUDE     [7:5]  driver amplitude / GSN-CW selector
//
// Reducing TX_CW_AMPLITUDE lowers the driver output level; increasing
// TX_RESIDUAL_CARRIER softens modulation depth. RfPower drives both from a
// single 0..100 % "field strength" value.
constexpr uint32_t RF_CONTROL_TX_RESIDUAL_CARRIER_MASK = 0x0000001Fu;
constexpr uint8_t RF_CONTROL_TX_RESIDUAL_CARRIER_SHIFT = 0;
constexpr uint32_t RF_CONTROL_TX_CW_AMPLITUDE_MASK = 0x000000E0u;
constexpr uint8_t RF_CONTROL_TX_CW_AMPLITUDE_SHIFT = 5;

// --- RF configuration sets used with LOAD_RF_CONFIG -----------------------
// TX config 0x00 / RX config 0x80 => ISO/IEC 14443-A, 106 kbit/s.
constexpr uint8_t RF_TX_ISO14443A_106 = 0x00;
constexpr uint8_t RF_RX_ISO14443A_106 = 0x80;

// --- ISO/IEC 14443-3 type A commands -------------------------------------
constexpr uint8_t ISO14443_REQA = 0x26;   // 7-bit short frame
constexpr uint8_t ISO14443_WUPA = 0x52;   // 7-bit short frame
constexpr uint8_t ISO14443_ANTICOLL_CL1 = 0x93;
constexpr uint8_t ISO14443_ANTICOLL_CL2 = 0x95;
constexpr uint8_t ISO14443_ANTICOLL_CL3 = 0x97;
constexpr uint8_t ISO14443_CT = 0x88;     // cascade tag marker

}  // namespace pn5180
