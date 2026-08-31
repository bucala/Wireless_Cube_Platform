// ---------------------------------------------------------------------------
//  NFC Dice Debugger - ESP32-S3 firmware entry point
//
//  Pipeline per loop tick:
//    1. run one ISO14443-3A inventory (how many tags does the field reach?)
//    2. maintain the "present tags" set and emit found/lost events
//    3. feed the result into the DPC tuner if an auto sweep is running
//    4. publish scan/state frames over WebSocket (+ serial mirror)
// ---------------------------------------------------------------------------

#include <Arduino.h>

#include "DiceLink.h"
#include "DpcTuner.h"
#include "Iso14443a.h"
#include "PN5180.h"
#include "RfPower.h"
#include "config.h"

namespace {

PN5180 reader(PIN_PN5180_NSS, PIN_PN5180_BUSY, PIN_PN5180_RST);
Iso14443a nfc(reader);
RfPower rfPower(reader);
DpcTuner tuner(nfc, rfPower);
DiceLink link;

struct PresentTag {
  TagUid uid;
  uint32_t firstSeenMs = 0;
  uint32_t lastSeenMs = 0;
  uint32_t sightings = 0;
};

PresentTag present[MAX_TAGS_PER_SCAN];
uint8_t presentCount = 0;

bool readerOk = false;
bool scanning = true;
bool fieldOn = true;

struct Stats {
  uint32_t scans = 0;
  uint32_t tagEvents = 0;
  uint32_t collisions = 0;
  uint32_t errors = 0;
} stats;

uint32_t lastScanMs = 0;
uint32_t lastStateMs = 0;
uint32_t lastScanFrameMs = 0;

void uidToJson(const TagUid& uid, JsonObject obj) {
  char hex[32];
  uid.toHex(hex, sizeof(hex));
  obj["uid"] = hex;
  obj["len"] = uid.len;
  obj["sak"] = uid.sak;
}

void sendHello() {
  JsonDocument doc;
  doc["t"] = "hello";
  doc["fw"] = FW_NAME;
  doc["version"] = FW_VERSION;
  doc["proto"] = PROTOCOL_VERSION;
  doc["chip"] = ESP.getChipModel();
  doc["ip"] = link.ipAddress();
  doc["ap"] = link.apMode();

  JsonObject rdr = doc["reader"].to<JsonObject>();
  rdr["ok"] = readerOk;
  rdr["product"] = reader.productVersion();
  rdr["firmware"] = reader.firmwareVersion();
  if (!readerOk) rdr["error"] = reader.lastError();

  JsonObject limits = doc["limits"].to<JsonObject>();
  limits["minPct"] = RF_POWER_MIN_PCT;
  limits["maxPct"] = RF_POWER_MAX_PCT;
  limits["maxTags"] = MAX_TAGS_PER_SCAN;
  limits["scanPeriodMs"] = SCAN_PERIOD_MS;

  link.send(doc);
}

void sendState() {
  JsonDocument doc;
  doc["t"] = "state";
  doc["ts"] = millis();
  doc["powerPct"] = rfPower.percent();
  doc["scanning"] = scanning;
  doc["rfOn"] = fieldOn;
  doc["agc"] = rfPower.agc();
  doc["readerOk"] = readerOk;
  doc["heap"] = ESP.getFreeHeap();
  doc["rssi"] = link.rssi();
  doc["clients"] = (uint32_t)link.clientCount();

  JsonObject rf = doc["rf"].to<JsonObject>();
  rf["cwAmplitude"] = rfPower.cwAmplitude();
  rf["residualCarrier"] = rfPower.residualCarrier();
  rf["extAttenuator"] = rfPower.externalAttenuator();

  JsonObject st = doc["stats"].to<JsonObject>();
  st["scans"] = stats.scans;
  st["tagEvents"] = stats.tagEvents;
  st["collisions"] = stats.collisions;
  st["errors"] = stats.errors;

  JsonObject dpc = doc["dpc"].to<JsonObject>();
  dpc["phase"] = dpcPhaseName(tuner.phase());
  dpc["resultPct"] = tuner.progress().resultPct;

  JsonArray tags = doc["present"].to<JsonArray>();
  for (uint8_t i = 0; i < presentCount; ++i) {
    JsonObject obj = tags.add<JsonObject>();
    uidToJson(present[i].uid, obj);
    obj["ageMs"] = millis() - present[i].firstSeenMs;
    obj["sightings"] = present[i].sightings;
  }

  link.send(doc);
}

void sendScanFrame(const InventoryResult& result) {
  JsonDocument doc;
  doc["t"] = "scan";
  doc["ts"] = millis();
  doc["powerPct"] = rfPower.percent();
  doc["count"] = result.count;
  doc["collision"] = result.collisionSeen;
  doc["truncated"] = result.truncated;
  doc["agc"] = result.agc;
  doc["durationUs"] = result.durationUs;

  JsonArray uids = doc["uids"].to<JsonArray>();
  for (uint8_t i = 0; i < result.count; ++i) {
    char hex[32];
    result.tags[i].toHex(hex, sizeof(hex));
    uids.add(hex);
  }
  link.send(doc);
}

void sendTagEvent(const TagUid& uid, const char* event, uint32_t dwellMs) {
  JsonDocument doc;
  doc["t"] = "tag";
  doc["ts"] = millis();
  doc["event"] = event;
  doc["powerPct"] = rfPower.percent();
  doc["dwellMs"] = dwellMs;
  uidToJson(uid, doc.as<JsonObject>());
  link.send(doc);
  stats.tagEvents++;
}

void sendDpcFrame() {
  const DpcProgress& p = tuner.progress();
  JsonDocument doc;
  doc["t"] = "dpc";
  doc["ts"] = millis();
  doc["phase"] = dpcPhaseName(p.phase);
  doc["powerPct"] = p.powerPct;
  doc["samples"] = p.samples;
  doc["singleHits"] = p.singleHits;
  doc["multiHits"] = p.multiHits;
  doc["emptyHits"] = p.emptyHits;
  doc["ceilingPct"] = p.ceilingPct;
  doc["lowEdgePct"] = p.lowEdgePct;
  doc["resultPct"] = p.resultPct;
  doc["note"] = p.note;
  link.send(doc);
}

// --- presence tracking -----------------------------------------------------

void trackPresence(const InventoryResult& result) {
  const uint32_t now = millis();

  for (uint8_t i = 0; i < result.count; ++i) {
    bool known = false;
    for (uint8_t j = 0; j < presentCount; ++j) {
      if (present[j].uid == result.tags[i]) {
        present[j].lastSeenMs = now;
        present[j].sightings++;
        known = true;
        break;
      }
    }
    if (!known && presentCount < MAX_TAGS_PER_SCAN) {
      PresentTag& slot = present[presentCount++];
      slot.uid = result.tags[i];
      slot.firstSeenMs = now;
      slot.lastSeenMs = now;
      slot.sightings = 1;
      sendTagEvent(slot.uid, "found", 0);
    }
  }

  // Expire tags that stopped answering. The TTL spans several scan periods so
  // one dropped frame at the field edge does not produce lost/found flicker.
  uint8_t write = 0;
  for (uint8_t i = 0; i < presentCount; ++i) {
    if (now - present[i].lastSeenMs <= TAG_PRESENCE_TTL_MS) {
      present[write++] = present[i];
    } else {
      sendTagEvent(present[i].uid, "lost", present[i].lastSeenMs - present[i].firstSeenMs);
    }
  }
  presentCount = write;
}

// --- command handling ------------------------------------------------------

bool parseUid(const char* text, TagUid& uid) {
  uid = TagUid{};
  uint8_t nibble = 0;
  uint8_t value = 0;
  for (const char* p = text; *p; ++p) {
    char c = *p;
    if (c == ':' || c == '-' || c == ' ') continue;
    uint8_t digit;
    if (c >= '0' && c <= '9')
      digit = (uint8_t)(c - '0');
    else if (c >= 'a' && c <= 'f')
      digit = (uint8_t)(c - 'a' + 10);
    else if (c >= 'A' && c <= 'F')
      digit = (uint8_t)(c - 'A' + 10);
    else
      return false;
    value = (uint8_t)((value << 4) | digit);
    if (++nibble == 2) {
      if (uid.len >= sizeof(uid.bytes)) return false;
      uid.bytes[uid.len++] = value;
      nibble = 0;
      value = 0;
    }
  }
  return nibble == 0 && uid.len >= 4;
}

void applyField(bool on) {
  if (on == fieldOn) return;
  fieldOn = on;
  if (on) {
    nfc.fieldOn();
    rfPower.captureBaseline();
  } else {
    nfc.fieldOff();
    for (uint8_t i = 0; i < presentCount; ++i)
      sendTagEvent(present[i].uid, "lost", present[i].lastSeenMs - present[i].firstSeenMs);
    presentCount = 0;
  }
}

void handleCommand(JsonObject cmd) {
  const char* type = cmd["t"] | "";

  if (strcmp(type, "getState") == 0) {
    sendHello();
    sendState();
    return;
  }

  if (strcmp(type, "ping") == 0) {
    JsonDocument doc;
    doc["t"] = "pong";
    doc["ts"] = millis();
    if (cmd["id"].is<uint32_t>()) doc["id"] = cmd["id"].as<uint32_t>();
    link.send(doc);
    return;
  }

  if (strcmp(type, "setPower") == 0) {
    if (!cmd["value"].is<int>()) {
      link.ack("setPower", false, "chýba číselné pole 'value'");
      return;
    }
    if (tuner.busy()) tuner.abort("prerušené manuálnou zmenou výkonu");
    const int value = cmd["value"].as<int>();
    const bool ok = rfPower.setPercent((uint8_t)constrain(value, 0, 100));
    link.ack("setPower", ok, ok ? "" : reader.lastError());
    sendState();
    return;
  }

  if (strcmp(type, "nudgePower") == 0) {
    const int delta = cmd["delta"] | 0;
    const int target = constrain((int)rfPower.percent() + delta, 0, 100);
    const bool ok = rfPower.setPercent((uint8_t)target);
    link.ack("nudgePower", ok);
    sendState();
    return;
  }

  if (strcmp(type, "scan") == 0) {
    scanning = cmd["enabled"] | true;
    link.ack("scan", true);
    sendState();
    return;
  }

  if (strcmp(type, "rf") == 0) {
    applyField(cmd["on"] | true);
    link.ack("rf", true);
    sendState();
    return;
  }

  if (strcmp(type, "autoTune") == 0) {
    const bool start = cmd["start"] | true;
    if (!start) {
      tuner.abort("zrušené používateľom");
      sendDpcFrame();
      link.ack("autoTune", true);
      return;
    }
    if (!readerOk) {
      link.ack("autoTune", false, "čítačka nie je inicializovaná");
      return;
    }
    const uint8_t startPct = (uint8_t)constrain((int)(cmd["startPct"] | RF_POWER_MAX_PCT),
                                                RF_POWER_MIN_PCT, RF_POWER_MAX_PCT);
    TagUid target;
    const char* targetText = cmd["targetUid"] | "";
    const bool haveTarget = *targetText && parseUid(targetText, target);
    scanning = true;
    applyField(true);
    tuner.start(startPct, haveTarget ? &target : nullptr);
    sendDpcFrame();
    link.ack("autoTune", true, haveTarget ? "ladím na zadaný UID" : "ladím na prvý tag v poli");
    return;
  }

  if (strcmp(type, "resetReader") == 0) {
    reader.hardReset();
    readerOk = nfc.begin() && rfPower.captureBaseline();
    presentCount = 0;
    link.ack("resetReader", readerOk, readerOk ? "" : nfc.lastError());
    sendHello();
    return;
  }

  if (strcmp(type, "reboot") == 0) {
    link.ack("reboot", true, "restartujem");
    delay(150);
    ESP.restart();
    return;
  }

  link.ack(type, false, "neznámy príkaz");
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.printf("[dice] %s %s booting\n", FW_NAME, FW_VERSION);

  if (PIN_STATUS_LED >= 0) {
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);
  }

  readerOk = reader.begin(PIN_PN5180_SCK, PIN_PN5180_MISO, PIN_PN5180_MOSI, PN5180_SPI_HZ);
  if (readerOk) {
    readerOk = nfc.begin();
    if (readerOk) readerOk = rfPower.captureBaseline();
  }
  if (!readerOk) {
    Serial.printf("[dice] reader init failed: %s / %s\n", reader.lastError(), nfc.lastError());
    stats.errors++;
  }

  link.begin(handleCommand);
  Serial.printf("[dice] ws://%s%s\n", link.ipAddress().c_str(), WS_PATH);
  sendHello();
}

void loop() {
  link.loop();
  const uint32_t now = millis();

  if (readerOk && scanning && fieldOn && now - lastScanMs >= SCAN_PERIOD_MS) {
    lastScanMs = now;

    InventoryResult result;
    nfc.inventory(result);
    stats.scans++;
    if (result.collisionSeen || result.count > 1) stats.collisions++;

    const uint8_t before = presentCount;
    trackPresence(result);

    // Rate limit the scan stream: emit on any change, otherwise 4x per second.
    const bool changed = before != presentCount || result.collisionSeen || result.count > 1;
    if (changed || now - lastScanFrameMs >= 250) {
      lastScanFrameMs = now;
      sendScanFrame(result);
    }

    if (tuner.busy()) {
      tuner.feed(result);
      if (tuner.consumeProgressDirty()) sendDpcFrame();
      if (!tuner.busy()) {
        sendDpcFrame();
        sendState();
      }
    }

    if (PIN_STATUS_LED >= 0) digitalWrite(PIN_STATUS_LED, presentCount > 0 ? HIGH : LOW);
  }

  if (now - lastStateMs >= STATE_PUSH_PERIOD_MS) {
    lastStateMs = now;
    sendState();
  }
}
