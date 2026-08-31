#pragma once

#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>

#include <functional>

#include "config.h"

// ---------------------------------------------------------------------------
//  Transport layer: WebSocket server (+ a mirrored line protocol on the USB
//  CDC port so the client can talk to the board over the Web Serial API when
//  no Wi-Fi is available).
//
//  Every frame is a single JSON object with a "t" (type) field; see
//  docs/PROTOCOL.md for the full schema.
// ---------------------------------------------------------------------------
class DiceLink {
 public:
  // Handler receives a parsed command object. `reply` lets the handler answer
  // the originating peer (or all peers, for a serial command).
  using CommandHandler = std::function<void(JsonObject cmd)>;

  bool begin(CommandHandler handler);
  void loop();

  bool wifiConnected() const { return staConnected_; }
  bool apMode() const { return apMode_; }
  String ipAddress() const;
  int32_t rssi() const;
  size_t clientCount() const { return ws_ ? ws_->count() : 0; }

  // Sends a document to every WebSocket client and to the serial mirror.
  void send(const JsonDocument& doc);

  // Convenience wrappers used by main.cpp.
  void ack(const char* cmd, bool ok, const char* message = "");
  void log(const char* level, const char* message);
  void logf(const char* level, const char* fmt, ...);

 private:
  bool connectWifi();
  void startAccessPoint();
  void mountRoutes();
  void pumpSerial();
  void handleText(const char* payload, size_t len);

  AsyncWebServer* server_ = nullptr;
  AsyncWebSocket* ws_ = nullptr;
  CommandHandler handler_;
  bool staConnected_ = false;
  bool apMode_ = false;
  String serialBuffer_;
};
