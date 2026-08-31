#pragma once

#include <Arduino.h>
#include <SPI.h>

#include "pn5180_defs.h"

// ---------------------------------------------------------------------------
//  Thin, blocking driver for the PN5180 host interface.
//
//  Every host command follows the same BUSY handshake:
//    1. wait for BUSY low            (front end ready for a new frame)
//    2. NSS low, clock the frame out
//    3. wait for BUSY high           (front end took the frame)
//    4. NSS high
//    5. wait for BUSY low            (command executed, answer buffered)
//  A response is then clocked out with a second NSS window.
// ---------------------------------------------------------------------------
class PN5180 {
 public:
  PN5180(int8_t nss, int8_t busy, int8_t rst, SPIClass& spi = SPI);

  // Configures the SPI bus/pins and hard-resets the front end.
  bool begin(int8_t sck, int8_t miso, int8_t mosi, uint32_t clockHz);
  void hardReset();

  // --- register access ---------------------------------------------------
  bool writeRegister(uint8_t reg, uint32_t value);
  bool writeRegisterOrMask(uint8_t reg, uint32_t orMask);
  bool writeRegisterAndMask(uint8_t reg, uint32_t andMask);
  bool readRegister(uint8_t reg, uint32_t& value);

  // Read-modify-write of a bit field inside one register.
  bool updateRegisterField(uint8_t reg, uint32_t mask, uint8_t shift, uint32_t value);

  // --- EEPROM ------------------------------------------------------------
  bool readEeprom(uint8_t addr, uint8_t* buf, uint8_t len);

  // --- RF plumbing -------------------------------------------------------
  bool loadRfConfig(uint8_t txConfig, uint8_t rxConfig);
  bool rfOn();
  bool rfOff();
  bool isRfOn();

  // --- transceive --------------------------------------------------------
  bool setTransceiveCommand(uint32_t command);
  uint8_t transceiveState();

  // `validBits` = number of significant bits in the last byte, 0 => all 8.
  bool sendData(const uint8_t* data, uint8_t len, uint8_t validBits = 0);
  bool readData(uint8_t* buf, uint16_t len);

  uint32_t irqStatus();
  bool clearIrq(uint32_t mask = pn5180::IRQ_ALL);
  // Blocks until every bit of `mask` (any of them) is raised, or timeout.
  bool waitForIrq(uint32_t mask, uint32_t timeoutMs);

  bool readRxStatus(uint32_t& rxStatus);
  uint16_t agcValue();

  const char* lastError() const { return lastError_; }
  uint32_t productVersion() const { return productVersion_; }
  uint32_t firmwareVersion() const { return firmwareVersion_; }

 private:
  bool transceiveCommand(const uint8_t* send, size_t sendLen, uint8_t* recv, size_t recvLen);
  bool waitBusy(bool level, uint32_t timeoutMs);
  void fail(const char* msg) { lastError_ = msg; }

  int8_t nss_;
  int8_t busy_;
  int8_t rst_;
  SPIClass& spi_;
  SPISettings settings_;
  const char* lastError_ = "";
  uint32_t productVersion_ = 0;
  uint32_t firmwareVersion_ = 0;
};
