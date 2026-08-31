# Protokol NFC Dice Debugger (v1)

Jedna správa = jeden JSON objekt. Rozlišuje sa poľom `t`.
Rovnaké rámce idú po **WebSocket** (`ws://<ip>/ws`) aj po **USB CDC** (newline
delimited JSON, 115200 Bd) – klient preto používa ten istý parser pre oba
transporty (`client/src/lib/protocol.ts`).

Zdroj pravdy na strane firmwaru: `firmware/src/main.cpp` (emitery) a
`firmware/src/DiceLink.cpp` (transport).

---

## Zariadenie → PC

### `hello`
Posiela sa po boote, po `getState` a po `resetReader`.

```json
{
  "t": "hello",
  "fw": "nfc-dice-debugger",
  "version": "1.0.0",
  "proto": "1",
  "chip": "ESP32-S3",
  "ip": "192.168.1.50",
  "ap": false,
  "reader": { "ok": true, "product": 258, "firmware": 772 },
  "limits": { "minPct": 5, "maxPct": 100, "maxTags": 8, "scanPeriodMs": 60 }
}
```

Ak inicializácia PN5180 zlyhá, `reader.ok = false` a `reader.error` obsahuje
dôvod (typicky chyba BUSY handshaku alebo zapojenia SPI).

### `state`
Heartbeat, 1×/s a po každom príkaze, ktorý mení stav.

```json
{
  "t": "state", "ts": 128340, "powerPct": 27, "scanning": true, "rfOn": true,
  "agc": 214, "readerOk": true, "heap": 231480, "rssi": -52, "clients": 1,
  "rf": { "cwAmplitude": 2, "residualCarrier": 19, "extAttenuator": false },
  "stats": { "scans": 1904, "tagEvents": 12, "collisions": 3, "errors": 0 },
  "dpc": { "phase": "done", "resultPct": 27 },
  "present": [{ "uid": "04:1A:7C:2B:5E:41:80", "len": 7, "ageMs": 4210, "sightings": 68 }]
}
```

### `scan`
Výsledok jednej inventarizácie. Posiela sa pri každej zmene množiny tagov,
inak maximálne 4×/s (rate limit vo `loop()`).

```json
{
  "t": "scan", "ts": 128401, "powerPct": 27, "count": 1,
  "collision": false, "truncated": false, "agc": 214, "durationUs": 3480,
  "uids": ["04:1A:7C:2B:5E:41:80"]
}
```

* `count > 1` alebo `collision = true` znamená, že pole zasahuje aj bočné steny
  → UI zobrazí varovanie *„Príliš vysoký výkon – detegované bočné steny“*.
* `truncated = true` = tagov je viac ako `MAX_TAGS_PER_SCAN`.

### `tag`
Hranové udalosti nad množinou prítomných tagov (TTL 350 ms).

```json
{ "t": "tag", "ts": 128401, "event": "found", "uid": "04:1A:…", "powerPct": 27, "len": 7, "sak": 0 }
{ "t": "tag", "ts": 130102, "event": "lost",  "uid": "04:1A:…", "powerPct": 27, "dwellMs": 1701 }
```

### `dpc`
Priebeh automatického ladenia výkonu.

```json
{
  "t": "dpc", "ts": 131002, "phase": "fine", "powerPct": 26,
  "samples": 4, "singleHits": 4, "multiHits": 0, "emptyHits": 0,
  "ceilingPct": 45, "lowEdgePct": 26, "resultPct": 0,
  "note": "hľadám dolnú hranu čítania"
}
```

`phase`: `idle` → `coarse` → `fine` → `verify` → `done` | `failed`.

### `ack`, `log`, `pong`

```json
{ "t": "ack", "cmd": "setPower", "ok": true }
{ "t": "ack", "cmd": "autoTune", "ok": false, "msg": "čítačka nie je inicializovaná" }
{ "t": "log", "level": "warn", "msg": "Wi-Fi odpojené", "ts": 91002 }
{ "t": "pong", "ts": 91500, "id": 7 }
```

---

## PC → zariadenie

| Príkaz | Payload | Význam |
| --- | --- | --- |
| `getState` | – | vyžiada `hello` + `state` |
| `ping` | `id?` | latency test, odpoveď `pong` |
| `setPower` | `value: 0..100` | nastaví silu poľa v % (prerušuje beží­ci DPC sweep) |
| `nudgePower` | `delta: ±n` | relatívna zmena |
| `scan` | `enabled: bool` | zapne/vypne inventarizačnú smyčku |
| `rf` | `on: bool` | zapne/vypne nosnú (RF_ON / RF_OFF) |
| `autoTune` | `start: bool`, `startPct?`, `targetUid?` | spustí/zruší DPC sweep |
| `resetReader` | – | hardvérový reset PN5180 + `LOAD_RF_CONFIG` |
| `reboot` | – | `ESP.restart()` |

Príklady:

```json
{ "t": "setPower", "value": 27 }
{ "t": "autoTune", "start": true, "startPct": 100, "targetUid": "04:1A:7C:2B:5E:41:80" }
{ "t": "rf", "on": false }
```

`targetUid` je dôležitý pri opakovanej kalibrácii: sweep potom počíta ako
„úspech“ iba ten konkrétny tag a ignoruje cudzí tag, ktorý by ležal vedľa
čítačky.

---

## HTTP endpointy

| Cesta | Popis |
| --- | --- |
| `GET /` | jednoduchá stránka s adresou WebSocketu |
| `GET /api/health` | `{fw, version, proto, ip, ws, clients, uptimeMs}` |

mDNS: služba `_nfc-dice._tcp` a hostname `nfc-dice.local`.

---

## Formát kalibračného profilu

Klient exportuje profil kocky ako JSON (`client/src/lib/profile.ts`):

```json
{
  "schema": "nfc-dice-profile/1",
  "id": "9f2c1a0b4d7e",
  "name": "Kocka 01",
  "createdAt": "2026-08-30T10:12:04.881Z",
  "updatedAt": "2026-08-30T10:19:44.102Z",
  "geometry": {
    "coreMm": 8,
    "shellMm": 12,
    "tagMm": 5,
    "tagShape": "square",
    "tagModel": "NTAG213",
    "cornerRadiusMm": 1.4,
    "pipDepthMm": 0.3
  },
  "rf": { "tunedPowerPct": 27, "ceilingPct": 45, "lowEdgePct": 24, "firmware": "1.0.0" },
  "bindings": [
    {
      "face": "ny",
      "uid": "04:1A:7C:2B:5E:41:80",
      "value": 6,
      "topValue": 1,
      "boundAt": "2026-08-30T10:19:44.102Z",
      "samples": 2
    }
  ]
}
```

`face` je jeden z `px | nx | py | ny | pz | nz`, `value` je počet bodiek na
príslušnej stene skla a `topValue = 7 − value` je hodnota, ktorú hráč vidí
zhora, keď táto stena leží na čítačke.

`geometry` je snapshot rozmerov (`client/src/lib/hardware.ts`) z doby merania.
Staršie profily s poľami `tagDiameterMm`/`tagType` sa pri importe automaticky
migrujú; chýbajúce alebo neplatné hodnoty sa doplnia výrobnými defaultmi
(jadro 8 mm, kocka 12 mm, tag 5 mm).
