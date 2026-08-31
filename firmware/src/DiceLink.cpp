#include "DiceLink.h"

#include <ESPmDNS.h>
#include <WiFi.h>

#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASS
#define WIFI_PASS ""
#endif

namespace {

// Minimal landing page: confirms the board is alive and shows where the
// WebSocket lives, so a browser hit on http://nfc-dice.local is not a 404.
const char kIndexHtml[] = R"HTML(<!doctype html>
<html lang="sk"><head><meta charset="utf-8">
<title>NFC Dice Debugger - bridge</title>
<style>
 body{background:#0b0f17;color:#e5e7eb;font:15px/1.6 ui-monospace,Consolas,monospace;padding:2rem}
 code{background:#111827;padding:.15rem .4rem;border-radius:.25rem;color:#38bdf8}
 h1{color:#38bdf8;font-size:1.25rem}
</style></head><body>
<h1>NFC Dice Debugger &mdash; ESP32-S3 bridge</h1>
<p>Firmware beží. WebSocket endpoint: <code id="ws"></code></p>
<p>Otvor desktopového klienta a zadaj túto adresu do Connection panelu.</p>
<script>document.getElementById('ws').textContent='ws://'+location.host+'/ws';</script>
</body></html>)HTML";

}  // namespace

bool DiceLink::begin(CommandHandler handler) {
  handler_ = std::move(handler);

  if (!connectWifi()) startAccessPoint();

  if (MDNS.begin(MDNS_HOSTNAME)) {
    MDNS.addService("http", "tcp", HTTP_PORT);
    MDNS.addService("nfc-dice", "tcp", HTTP_PORT);
  }

  server_ = new AsyncWebServer(HTTP_PORT);
  ws_ = new AsyncWebSocket(WS_PATH);

  ws_->onEvent([this](AsyncWebSocket*, AsyncWebSocketClient* client, AwsEventType type,
                      void* arg, uint8_t* data, size_t len) {
    switch (type) {
      case WS_EVT_CONNECT:
        // The hello frame is produced by main.cpp on the next loop tick; the
        // client also asks for it explicitly, so nothing to do here.
        log("info", "klient pripojený");
        break;
      case WS_EVT_DISCONNECT:
        log("info", "klient odpojený");
        break;
      case WS_EVT_DATA: {
        AwsFrameInfo* info = static_cast<AwsFrameInfo*>(arg);
        if (info->final && info->index == 0 && info->len == len &&
            info->opcode == WS_TEXT) {
          handleText(reinterpret_cast<const char*>(data), len);
        }
        break;
      }
      default:
        break;
    }
    (void)client;
  });

  server_->addHandler(ws_);
  mountRoutes();
  server_->begin();
  return true;
}

void DiceLink::mountRoutes() {
  server_->on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(200, "text/html; charset=utf-8", kIndexHtml);
  });

  // Plain HTTP health endpoint, handy for scripts and for the client's
  // "discover device" button.
  server_->on("/api/health", HTTP_GET, [this](AsyncWebServerRequest* request) {
    JsonDocument doc;
    doc["fw"] = FW_NAME;
    doc["version"] = FW_VERSION;
    doc["proto"] = PROTOCOL_VERSION;
    doc["ip"] = ipAddress();
    doc["ws"] = String("ws://") + ipAddress() + WS_PATH;
    doc["clients"] = (uint32_t)clientCount();
    doc["uptimeMs"] = millis();
    String out;
    serializeJson(doc, out);
    request->send(200, "application/json", out);
  });

  server_->onNotFound([](AsyncWebServerRequest* request) {
    if (request->method() == HTTP_OPTIONS) {
      request->send(200);
      return;
    }
    request->send(404, "application/json", "{\"error\":\"not found\"}");
  });

  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
}

bool DiceLink::connectWifi() {
  const char* ssid = WIFI_SSID;
  if (ssid == nullptr || strlen(ssid) == 0) return false;

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // SPI polling + modem sleep make latency spiky
  WiFi.begin(ssid, WIFI_PASS);

  const uint32_t deadline = millis() + WIFI_CONNECT_TIMEOUT_MS;
  while (WiFi.status() != WL_CONNECTED && (int32_t)(millis() - deadline) < 0) delay(150);

  staConnected_ = WiFi.status() == WL_CONNECTED;
  apMode_ = false;
  return staConnected_;
}

void DiceLink::startAccessPoint() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  apMode_ = true;
  staConnected_ = false;
}

String DiceLink::ipAddress() const {
  return apMode_ ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
}

int32_t DiceLink::rssi() const { return apMode_ ? 0 : WiFi.RSSI(); }

void DiceLink::send(const JsonDocument& doc) {
  String payload;
  serializeJson(doc, payload);
  if (ws_ && ws_->count() > 0) ws_->textAll(payload);
  // Serial mirror: newline delimited JSON, consumed by the Web Serial client.
  Serial.println(payload);
}

void DiceLink::ack(const char* cmd, bool ok, const char* message) {
  JsonDocument doc;
  doc["t"] = "ack";
  doc["cmd"] = cmd;
  doc["ok"] = ok;
  if (message && *message) doc["msg"] = message;
  send(doc);
}

void DiceLink::log(const char* level, const char* message) {
  JsonDocument doc;
  doc["t"] = "log";
  doc["level"] = level;
  doc["msg"] = message;
  doc["ts"] = millis();
  send(doc);
}

void DiceLink::logf(const char* level, const char* fmt, ...) {
  char buf[192];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  log(level, buf);
}

void DiceLink::handleText(const char* payload, size_t len) {
  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, payload, len);
  if (err) {
    ack("?", false, err.c_str());
    return;
  }
  if (!doc.is<JsonObject>()) {
    ack("?", false, "expected a JSON object");
    return;
  }
  if (handler_) handler_(doc.as<JsonObject>());
}

void DiceLink::pumpSerial() {
  while (Serial.available() > 0) {
    const char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBuffer_.length() > 1) handleText(serialBuffer_.c_str(), serialBuffer_.length());
      serialBuffer_ = "";
    } else {
      if (serialBuffer_.length() > 512) serialBuffer_ = "";  // runaway guard
      serialBuffer_ += c;
    }
  }
}

void DiceLink::loop() {
  pumpSerial();
  if (ws_) ws_->cleanupClients();

  // Re-associate if the AP dropped us. The AP fallback stays up as-is.
  if (!apMode_) {
    const bool connected = WiFi.status() == WL_CONNECTED;
    if (connected != staConnected_) {
      staConnected_ = connected;
      log(connected ? "info" : "warn", connected ? "Wi-Fi pripojené" : "Wi-Fi odpojené");
    }
  }
}
