#include "DpcTuner.h"

#include <Arduino.h>

#include "dice_math.h"

const char* dpcPhaseName(DpcPhase phase) {
  switch (phase) {
    case DpcPhase::Idle: return "idle";
    case DpcPhase::Coarse: return "coarse";
    case DpcPhase::Fine: return "fine";
    case DpcPhase::Verify: return "verify";
    case DpcPhase::Done: return "done";
    case DpcPhase::Failed: return "failed";
  }
  return "idle";
}

bool DpcTuner::applyPower(uint8_t pct) {
  if (pct < RF_POWER_MIN_PCT) pct = RF_POWER_MIN_PCT;
  if (pct > RF_POWER_MAX_PCT) pct = RF_POWER_MAX_PCT;
  current_ = pct;
  progress_.powerPct = pct;
  return rf_.setPercent(pct);
}

void DpcTuner::resetCounters() {
  progress_.samples = 0;
  progress_.singleHits = 0;
  progress_.multiHits = 0;
  progress_.emptyHits = 0;
}

void DpcTuner::enterPhase(DpcPhase phase, uint8_t powerPct, const char* note) {
  phase_ = phase;
  progress_.phase = phase;
  progress_.note = note;
  progress_.ceilingPct = ceiling_;
  progress_.lowEdgePct = lowEdge_;
  resetCounters();
  if (powerPct) applyPower(powerPct);
  progressDirty_ = true;
}

bool DpcTuner::start(uint8_t startPct, const TagUid* targetUid) {
  haveTarget_ = targetUid != nullptr && targetUid->len > 0;
  if (haveTarget_) target_ = *targetUid;

  // A sweep only means something with the carrier up, and LOAD_RF_CONFIG (inside
  // fieldOn) restores the TX register defaults - so the baseline has to be
  // re-read before the first step is applied.
  if (!nfc_.fieldOn() || !rf_.captureBaseline()) {
    phase_ = DpcPhase::Failed;
    progress_.phase = phase_;
    progress_.note = nfc_.lastError();
    progressDirty_ = true;
    return false;
  }

  ceiling_ = 0;
  lowEdge_ = 0;
  progress_ = DpcProgress{};
  progress_.resultPct = 0;
  enterPhase(DpcPhase::Coarse, startPct ? startPct : RF_POWER_MAX_PCT, "hrubé hľadanie stropu");
  return true;
}

void DpcTuner::abort(const char* reason) {
  phase_ = DpcPhase::Idle;
  progress_.phase = DpcPhase::Idle;
  progress_.note = reason;
  progressDirty_ = true;
}

bool DpcTuner::consumeProgressDirty() {
  const bool dirty = progressDirty_;
  progressDirty_ = false;
  return dirty;
}

bool DpcTuner::matchesTarget(const InventoryResult& result) const {
  if (!haveTarget_) return result.count == 1;
  if (result.count != 1) return false;
  return result.tags[0] == target_;
}

void DpcTuner::feed(const InventoryResult& result) {
  if (!busy()) return;

  const dicemath::Verdict verdict = dicemath::classify(result.count, result.collisionSeen,
                                                       result.truncated, matchesTarget(result));
  const bool multi = verdict == dicemath::Verdict::Multi;
  const bool single = verdict == dicemath::Verdict::Single;

  progress_.samples++;
  if (multi)
    progress_.multiHits++;
  else if (single)
    progress_.singleHits++;
  else
    progress_.emptyHits++;
  progressDirty_ = true;

  // A collision is decisive: side faces are inside the field, drop power now
  // instead of burning the rest of the sample budget.
  if (multi && phase_ != DpcPhase::Verify) {
    const uint8_t step = phase_ == DpcPhase::Coarse ? DPC_COARSE_STEP_PCT : DPC_FINE_STEP_PCT;
    if (current_ <= RF_POWER_MIN_PCT + step) {
      progress_.note = "kolízia aj pri minimálnom výkone - skontroluj geometriu antény";
      phase_ = DpcPhase::Failed;
      progress_.phase = phase_;
      return;
    }
    enterPhase(phase_, (uint8_t)(current_ - step),
               phase_ == DpcPhase::Coarse ? "kolízia - znižujem výkon"
                                          : "kolízia v jemnom kroku - znižujem");
    return;
  }

  if (progress_.samples < DPC_SAMPLES_PER_STEP) return;

  const bool stable = progress_.singleHits >= DPC_MIN_HITS_FOR_STABLE;

  switch (phase_) {
    case DpcPhase::Coarse:
      if (stable) {
        ceiling_ = current_;
        lowEdge_ = current_;
        enterPhase(DpcPhase::Fine, (uint8_t)(current_ - DPC_FINE_STEP_PCT),
                   "hľadám dolnú hranu čítania");
      } else if (current_ <= RF_POWER_MIN_PCT + DPC_COARSE_STEP_PCT) {
        progress_.note = "žiadny tag sa neprihlásil - polož kocku na čítačku";
        phase_ = DpcPhase::Failed;
        progress_.phase = phase_;
      } else {
        // Nothing answered: the field is already too weak for the bottom tag,
        // so this level cannot be the ceiling either. Keep descending only if
        // we never saw a tag; otherwise we would walk past the read range.
        if (ceiling_ == 0 && progress_.emptyHits == progress_.samples &&
            current_ < RF_POWER_MAX_PCT) {
          progress_.note = "prázdne pole - skús vyšší štartovací výkon";
          phase_ = DpcPhase::Failed;
          progress_.phase = phase_;
        } else {
          enterPhase(DpcPhase::Coarse, (uint8_t)(current_ - DPC_COARSE_STEP_PCT),
                     "nestabilné čítanie - znižujem výkon");
        }
      }
      break;

    case DpcPhase::Fine:
      if (stable && current_ > RF_POWER_MIN_PCT) {
        lowEdge_ = current_;
        enterPhase(DpcPhase::Fine, (uint8_t)(current_ - DPC_FINE_STEP_PCT),
                   "hľadám dolnú hranu čítania");
      } else {
        // Below the read range: go back up by the safety headroom, but never
        // above the collision-free ceiling.
        uint16_t candidate = (uint16_t)lowEdge_ + DPC_HEADROOM_PCT;
        if (ceiling_ > 0 && candidate > ceiling_)
          candidate = (uint16_t)((lowEdge_ + ceiling_ + 1) / 2);
        progress_.resultPct = (uint8_t)candidate;
        enterPhase(DpcPhase::Verify, (uint8_t)candidate, "overujem odporúčaný výkon");
      }
      break;

    case DpcPhase::Verify:
      if (stable && progress_.multiHits == 0) {
        progress_.resultPct = current_;
        progress_.note = "hotovo - v poli je práve jeden tag";
        phase_ = DpcPhase::Done;
        progress_.phase = phase_;
      } else if (progress_.multiHits > 0 && current_ > RF_POWER_MIN_PCT) {
        enterPhase(DpcPhase::Verify, (uint8_t)(current_ - DPC_FINE_STEP_PCT),
                   "overenie zlyhalo na kolízii - o krok nižšie");
      } else if (current_ < ceiling_) {
        enterPhase(DpcPhase::Verify, (uint8_t)(current_ + DPC_FINE_STEP_PCT),
                   "overenie zlyhalo na výpadku - o krok vyššie");
      } else {
        progress_.note = "nenašlo sa okno, v ktorom je čitateľný len spodný tag";
        phase_ = DpcPhase::Failed;
        progress_.phase = phase_;
      }
      break;

    default:
      break;
  }
}
