# Changelog

Formát vychádza z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
verzovanie podľa [Semantic Versioning](https://semver.org/lang/sk/).

## [Unreleased]

### Plánované
- Uloženie doladeného výkonu do EEPROM PN5180 (štart už naladený).
- Správa viacerých profilov kociek v jednom UI.
- Zápis mapovania stien do užívateľskej pamäte NTAG213.

## [1.0.0] – 2026-08-30

Prvé kompletné vydanie platformy NFC Dice Debugger.

### Firmware (ESP32-S3 + PN5180)
- PlatformIO projekt pre `esp32-s3-devkitc-1` s pamäťovým profilom N16R8
  (16 MB QIO flash, 8 MB OPI PSRAM).
- `PN5180` – blokujúci driver host interface: kompletný BUSY handshake, prístup
  k registrom (write / OR / AND mask / read), EEPROM, `LOAD_RF_CONFIG`,
  `RF_ON`/`RF_OFF`, `SEND_DATA`/`READ_DATA`, IRQ a AGC.
- `pn5180_defs.h` – príkazy, registre a bitové polia na jednom mieste vrátane
  `RF_CONTROL_TX` (`TX_CW_AMPLITUDE`, `TX_RESIDUAL_CARRIER`).
- `Iso14443a` – REQA/WUPA, plná bit-frame anticollision smyčka s riešením
  kolízií podľa `RX_COLLISION_POS`, kaskádové SELECT (4/7/10 B UID), kontrola
  BCC, HALT po každom vyriešenom tagu → inventarizácia celej množiny tagov.
- `RfPower` – mapovanie 0–100 % na analógovú TX časť (monotónna stupnica),
  podpora voliteľného externého atenuátora pre spodok rozsahu.
- `DpcTuner` – neblokujúci stavový automat `coarse → fine → verify` s okamžitou
  reakciou na kolíziu, hľadaním dolnej hrany čítania a bezpečnostnou rezervou;
  voliteľne ladí na konkrétny cieľový UID.
- `DiceLink` – `AsyncWebServer` + `AsyncWebSocket` na `/ws`, mDNS
  (`nfc-dice.local`, služba `_nfc-dice._tcp`), `GET /api/health`, jednoduchá
  landing page a zrkadlenie všetkých rámcov na USB CDC (newline JSON).
- SoftAP fallback (`NFC-Dice-Debugger` / `dice1234`), keď nie sú Wi-Fi údaje.
- Presence tracking s TTL 350 ms → hranové udalosti `found` / `lost` bez
  blikania na hranici poľa; rate-limited stream `scan` rámcov.
- Natívne unit testy (`pio test -e native`) pre čistú logiku: klasifikácia
  verdiktov DPC, formátovanie UID, `7 − dole`, clamp percent.

### Klient (React + Vite + TailwindCSS + react-three-fiber)
- Dark-mode dashboard s panelmi Pripojenie, Signal & DPC Tuner, Live log UID,
  Kalibrácia a metrikami (výkon, tagy v poli, AGC, sken/s, kolízie, trvanie).
- Tri transporty za jedným rozhraním: WebSocket (auto-reconnect s backoffom a
  bufferovaním príkazov), Web Serial (COM port, Chromium) a offline simulátor
  s fyzikálne motivovaným modelom poľa a vlastným DPC sweepom.
- `useDeviceLink` – stav spojenia, telemetria, throttling posuvníka (60 ms) a
  potlačenie echa výkonu počas ťahania.
- Varovanie *„Príliš vysoký výkon – detegované bočné steny“* pri viacerých UID
  alebo nahlásenej kolízii.
- 3D scéna: jadro 7,5 mm s kruhovými 5 mm tagmi, sklenený obal 12 mm
  (`MeshTransmissionMaterial`) s gravírovanými bodkami 1–6, stylizovaná anténa
  PN5180, vizualizácia poľa škálovaná podľa výkonu, procedurálne prostredie
  (bez sťahovania HDRI, funguje offline).
- Párovacia logika: zachytenie stabilného UID → výzva na klik na spodnú stenu
  jadra → naviazanie UID ↔ stena, dopočítanie hodnoty hore (`7 − dole`),
  uloženie RF nastavení zo sweepu.
- Kalibračný profil `nfc-dice-profile/1`: automatické ukladanie do
  `localStorage`, export/import JSON, validácia pri importe, odpájanie stien.
- Vitest testy pre geometriu kocky, kalibračný profil a wire protokol.
- Voliteľný Tauri shell pre balenie do Windows `.msi` / NSIS installeru.

### Dokumentácia a CI
- `README.md` – prehľad, rýchly štart, pracovný postup ladenia a kalibrácie,
  štruktúra repozitára, riešenie problémov.
- `docs/ARCHITECTURE.md` – dátový tok, DPC algoritmus, dôvody pre tri transporty.
- `docs/HARDWARE.md` – zoznam komponentov, tabuľka zapojenia, RF poznámky,
  geometria a prahy jednotlivých tagov.
- `docs/PROTOCOL.md` – kompletná schéma JSON rámcov, príkazov, HTTP endpointov
  a formátu kalibračného profilu.
- GitHub Actions: kompilácia firmwaru, natívne testy, typecheck, vitest a build
  klienta.

[Unreleased]: https://github.com/bucala/Wireless_Cube_Platform/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/bucala/Wireless_Cube_Platform/releases/tag/v1.0.0
