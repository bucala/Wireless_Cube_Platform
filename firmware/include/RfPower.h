#pragma once

#include <stdint.h>

#include "PN5180.h"
#include "config.h"

// ---------------------------------------------------------------------------
//  Field strength control for the PN5180.
//
//  The wire protocol speaks in "percent of nominal field" (5..100 %). This
//  class maps that scalar onto the analog TX front end:
//
//    * TX_CW_AMPLITUDE   (RF_CONTROL_TX[7:5])  coarse driver amplitude
//    * TX_RESIDUAL_CARRIER (RF_CONTROL_TX[4:0]) fine trim
//    * optional external attenuator on PIN_EXT_ATTENUATOR for the bottom of
//      the range, where register-only control loses resolution
//
//  Percent is a monotonic, repeatable control knob rather than a calibrated
//  A/m figure - the actual field depends on the antenna. Measure once with a
//  reference coil if you need absolute values; the tuner only needs monotonicity.
// ---------------------------------------------------------------------------
class RfPower {
 public:
  explicit RfPower(PN5180& reader) : reader_(reader) {}

  // Re-reads the register defaults installed by LOAD_RF_CONFIG. Call after
  // every loadRfConfig(), because that command overwrites RF_CONTROL_TX.
  bool captureBaseline();

  // Applies a field strength in percent (clamped to the configured range).
  bool setPercent(uint8_t percent);
  uint8_t percent() const { return percent_; }

  // The register values currently programmed, for telemetry/debugging.
  uint8_t cwAmplitude() const { return cwAmplitude_; }
  uint8_t residualCarrier() const { return residualCarrier_; }
  bool externalAttenuator() const { return extAttenuator_; }

  // Receiver gain the front end had to apply. A tag entering the field loads
  // the antenna and the AGC value moves; the client plots this as "load".
  uint16_t agc() const { return reader_.agcValue(); }

 private:
  struct Setting {
    uint8_t cwAmplitude;       // RF_CONTROL_TX[7:5], 7 = strongest
    uint8_t residualCarrier;   // RF_CONTROL_TX[4:0]
    bool attenuator;           // external series attenuator engaged
  };

  static Setting mapPercent(uint8_t percent);

  PN5180& reader_;
  uint8_t percent_ = RF_POWER_DEFAULT_PCT;
  uint8_t cwAmplitude_ = 7;
  uint8_t residualCarrier_ = 0;
  bool extAttenuator_ = false;
  uint32_t baselineRfControlTx_ = 0;
  bool haveBaseline_ = false;
};
