#pragma once

#include <stdint.h>

#include "Iso14443a.h"
#include "RfPower.h"

// ---------------------------------------------------------------------------
//  Dynamic Power Control - the automatic "one tag only" search.
//
//  Physical problem: a 10 mm dice core carries six 5 mm NTAG213 inlays. The
//  one lying on the reader is at ~0 mm, the four side faces sit 4-5 mm away and
//  the top face ~7 mm. At full field strength the PN5180 reaches several of
//  them and the anticollision loop returns 2..6 UIDs. The firmware therefore
//  walks the field down until exactly one UID answers, with enough headroom
//  that the bottom tag never drops out.
//
//  The tuner is a non-blocking state machine: main.cpp keeps running its normal
//  scan cadence and feeds every inventory result in via feed(). That keeps the
//  WebSocket responsive during a sweep and means the client sees live progress.
//
//    Coarse : step down COARSE_STEP until no inventory reports >1 UID
//    Fine   : step down FINE_STEP while the single UID stays stable, to find
//             the lower edge of the read range
//    Verify : lowEdge + headroom (never above the collision-free ceiling),
//             re-checked for stability
// ---------------------------------------------------------------------------

enum class DpcPhase : uint8_t {
  Idle = 0,
  Coarse,
  Fine,
  Verify,
  Done,
  Failed,
};

const char* dpcPhaseName(DpcPhase phase);

struct DpcProgress {
  DpcPhase phase = DpcPhase::Idle;
  uint8_t powerPct = 0;       // level currently under test
  uint8_t samples = 0;        // samples collected at this level
  uint8_t singleHits = 0;     // of which exactly one UID answered
  uint8_t multiHits = 0;      // of which more than one UID / a collision
  uint8_t emptyHits = 0;      // of which nothing answered
  uint8_t ceilingPct = 0;     // highest collision-free level found so far
  uint8_t lowEdgePct = 0;     // lowest level that still read the bottom tag
  uint8_t resultPct = 0;      // recommendation once phase == Done
  const char* note = "";
};

class DpcTuner {
 public:
  DpcTuner(Iso14443a& nfc, RfPower& rf) : nfc_(nfc), rf_(rf) {}

  // `startPct` defaults to the top of the allowed range. `targetUid` may be
  // left empty; if it is set, only that UID counts as "the bottom tag", which
  // makes the sweep immune to a stray tag lying next to the reader.
  bool start(uint8_t startPct, const TagUid* targetUid = nullptr);
  void abort(const char* reason = "aborted");

  bool busy() const { return phase_ == DpcPhase::Coarse || phase_ == DpcPhase::Fine ||
                             phase_ == DpcPhase::Verify; }
  DpcPhase phase() const { return phase_; }
  const DpcProgress& progress() const { return progress_; }
  bool consumeProgressDirty();

  // Feed one inventory result taken at the current power level.
  void feed(const InventoryResult& result);

 private:
  void enterPhase(DpcPhase phase, uint8_t powerPct, const char* note);
  void resetCounters();
  bool applyPower(uint8_t pct);
  bool matchesTarget(const InventoryResult& result) const;

  Iso14443a& nfc_;
  RfPower& rf_;

  DpcPhase phase_ = DpcPhase::Idle;
  DpcProgress progress_{};
  bool progressDirty_ = false;

  uint8_t current_ = RF_POWER_DEFAULT_PCT;
  uint8_t ceiling_ = 0;    // highest level without collisions
  uint8_t lowEdge_ = 0;    // lowest level with a stable single read
  bool haveTarget_ = false;
  TagUid target_{};
};
