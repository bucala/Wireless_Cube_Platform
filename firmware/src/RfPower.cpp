#include "RfPower.h"

#include <Arduino.h>

using namespace pn5180;

bool RfPower::captureBaseline() {
  if (!reader_.readRegister(REG_RF_CONTROL_TX, baselineRfControlTx_)) return false;
  haveBaseline_ = true;
  if (PIN_EXT_ATTENUATOR >= 0) {
    pinMode(PIN_EXT_ATTENUATOR, OUTPUT);
    digitalWrite(PIN_EXT_ATTENUATOR, LOW);
  }
  return setPercent(percent_);
}

// The mapping is intentionally table-like: the top half of the range trims the
// residual carrier only (fine, ~1 %/step), below 60 % the driver amplitude is
// stepped down as well, and the last ~15 % engage the external attenuator when
// one is fitted. Values were chosen so the curve stays strictly monotonic,
// which is the only property the auto-tuner depends on.
RfPower::Setting RfPower::mapPercent(uint8_t percent) {
  if (percent > 100) percent = 100;

  Setting s{};
  if (percent >= 60) {
    // 60..100 % -> full driver amplitude, residual carrier 0..12
    s.cwAmplitude = 7;
    s.residualCarrier = (uint8_t)((100 - percent) * 12 / 40);
    s.attenuator = false;
  } else if (percent >= 35) {
    // 35..59 % -> amplitude 6..4, residual carrier 8..20
    s.cwAmplitude = (uint8_t)(4 + (percent - 35) * 3 / 25);
    s.residualCarrier = (uint8_t)(8 + (59 - percent) * 12 / 24);
    s.attenuator = false;
  } else if (percent >= 15) {
    // 15..34 % -> amplitude 3..1, residual carrier 16..28
    s.cwAmplitude = (uint8_t)(1 + (percent - 15) * 2 / 19);
    s.residualCarrier = (uint8_t)(16 + (34 - percent) * 12 / 19);
    s.attenuator = false;
  } else {
    // Bottom of the range: keep the smallest register setting and add the
    // external attenuator, if the board has one.
    s.cwAmplitude = 0;
    s.residualCarrier = (uint8_t)(24 + (14 - (percent > 14 ? 14 : percent)) / 2);
    s.attenuator = PIN_EXT_ATTENUATOR >= 0;
  }
  if (s.cwAmplitude > 7) s.cwAmplitude = 7;
  if (s.residualCarrier > 31) s.residualCarrier = 31;
  return s;
}

bool RfPower::setPercent(uint8_t percent) {
  if (percent < RF_POWER_MIN_PCT) percent = RF_POWER_MIN_PCT;
  if (percent > RF_POWER_MAX_PCT) percent = RF_POWER_MAX_PCT;

  const Setting s = mapPercent(percent);

  uint32_t value = baselineRfControlTx_;
  if (!haveBaseline_) {
    if (!reader_.readRegister(REG_RF_CONTROL_TX, value)) return false;
    baselineRfControlTx_ = value;
    haveBaseline_ = true;
  }
  value &= ~(RF_CONTROL_TX_CW_AMPLITUDE_MASK | RF_CONTROL_TX_RESIDUAL_CARRIER_MASK);
  value |= ((uint32_t)s.cwAmplitude << RF_CONTROL_TX_CW_AMPLITUDE_SHIFT) &
           RF_CONTROL_TX_CW_AMPLITUDE_MASK;
  value |= ((uint32_t)s.residualCarrier << RF_CONTROL_TX_RESIDUAL_CARRIER_SHIFT) &
           RF_CONTROL_TX_RESIDUAL_CARRIER_MASK;

  if (!reader_.writeRegister(REG_RF_CONTROL_TX, value)) return false;

  if (PIN_EXT_ATTENUATOR >= 0) digitalWrite(PIN_EXT_ATTENUATOR, s.attenuator ? HIGH : LOW);

  percent_ = percent;
  cwAmplitude_ = s.cwAmplitude;
  residualCarrier_ = s.residualCarrier;
  extAttenuator_ = s.attenuator;

  // The analog front end needs a moment before the next inventory sees the
  // new field; without this the first scan after a step is unreliable.
  delayMicroseconds(600);
  return true;
}
