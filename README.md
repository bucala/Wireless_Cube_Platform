# Wireless Cube Platform — NFC Dice Debugger

Ladiaca platforma pre miniatúrne NFC kocky: **ESP32-S3 + PN5180** ako čítačka a
**desktopový React dashboard** na ladenie sily poľa, live sledovanie UID a 3D
kalibráciu stien kocky.

Kocka má priesvitný obal **12 × 12 × 12 mm** s klasickými bodkami 1–6 a
nepriehľadné jadro **8 × 8 × 8 mm**, v strede každej steny je zalitý
**NTAG213 5 × 5 mm** (štvorcový inlay). Keď kocka leží na čítačke, spodný tag je
na ~0 mm, bočné na ~4–5 mm a vrchný na ~8 mm. Celý projekt je o tom, ako
spoľahlivo čítať **iba ten spodný**. Rozmery jadra, obalu aj tagu sú v klienti
runtime konfigurácia, takže model sa prispôsobí tvojej reálnej kocke.

```
┌ ESP32-S3-WROOM-1 N16R8 ┐   ws://nfc-dice.local/ws   ┌ Windows / React ┐
│ PN5180 (SPI, DPC)      │ ─────── JSON rámce ──────► │ Dashboard + 3D  │
│ ISO14443-A inventory   │ ◄────── príkazy ────────── │ Kalibrácia      │
└────────────────────────┘   (alebo USB / WebSerial)  └─────────────────┘
```

---

## Čo platforma robí

* **Dynamic Power Control (DPC).** Firmware plynulo znižuje TX výkon PN5180, kým
  v poli nezostane práve jeden tag – ten na 0 mm. Automatický sweep
  (`coarse → fine → verify`) aj ručný posuvník v UI.
* **Detekcia kolízií.** Inventarizácia beží ako plná bit-frame anticollision
  smyčka ISO/IEC 14443-3A, takže firmware vie povedať *koľko* tagov pole
  zasahuje. Pri >1 UID dashboard zobrazí varovanie
  *„Príliš vysoký výkon – detegované bočné steny“*.
* **Live log UID** s hranovými udalosťami `found` / `lost`, výkonom pri načítaní,
  AGC a dobou trvania skenu.
* **Interaktívny 3D model** kocky (react-three-fiber): nepriehľadné jadro s
  vyznačenými 5 mm tagmi, sklenený obal s vyrazenými bodkami a vizualizácia
  poľa antény, ktorá sa mení s nastaveným výkonom. Rotáciu možno pozastaviť,
  prepínať pohľady (ISO/predok/vrch/bok), rozložiť zostavu (exploded view) a
  skryť ktorýkoľvek prvok – jadro, plášť, TAG, bodky, pole, čítačku.
* **Definícia zostavy.** Rozmery jadra (default 8 mm), vonkajšej kocky
  (default 12 mm), rozmer, tvar aj model tagu (default NTAG213 5 × 5 mm) sa
  zadávajú v paneli *Rozmery a zostava*; špecifikácia MCU (ESP32-S3-WROOM-1
  N16R8) a čítačky (PN5180, hardvérové SPI) vrátane pinoutu je v paneli
  *Hardvér*. Geometria sa validuje a ukladá aj do kalibračného profilu.
* **Tri farebné skiny.** Skin 1 (biela + oranžová s čiernymi a červenými
  prvkami), Skin 2 (sivá + oranžová) a tmavý Skin 3; prepínač je v hlavičke,
  farí sa celé UI aj 3D scéna.
* **Párovanie stien klikaním.** Aplikácia zachytí UID spodného tagu a vyzve ťa,
  aby si na 3D modeli klikol na stenu, ktorá práve leží dole. Dopočíta hodnotu
  hore (`7 − dole`) a uloží kalibračný JSON profil kocky.
* **Simulátor.** Celý workflow (vrátane DPC sweepu a párovania) sa dá odskúšať
  bez hardvéru – klient obsahuje model kocky aj poľa.

---

## Rýchly štart

### 1. Firmware (PlatformIO)

```bash
cd firmware
cp include/secrets.h.example include/secrets.h   # doplň WIFI_SSID / WIFI_PASS
pio run -t upload
pio device monitor
```

Bez `secrets.h` (alebo bez `-DWIFI_SSID`) sa doska prepne do SoftAP:
SSID `NFC-Dice-Debugger`, heslo `dice1234`, WebSocket `ws://192.168.4.1/ws`.
Pri úspešnom pripojení na Wi-Fi funguje aj `ws://nfc-dice.local/ws`.

Zapojenie PN5180 ↔ ESP32-S3 je v [docs/HARDWARE.md](docs/HARDWARE.md)
(predvolene SCK 12, MISO 13, MOSI 11, NSS 10, BUSY 9, RST 8, IRQ 7).

### 2. Klient (Vite + React)

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

V paneli **Pripojenie** vyber transport:

| Transport | Kedy použiť |
| --- | --- |
| **WebSocket** | doska je na Wi-Fi – zadaj IP alebo `nfc-dice.local` |
| **Web Serial** | doska visí len na USB (Chrome/Edge, vyberie sa COM port) |
| **Simulátor** | bez hardvéru – model kocky so šiestimi tagmi |

### 3. Desktopová appka (voliteľné, Tauri)

```bash
cd client
npm run tauri build     # .msi / NSIS installer pre Windows
```

---

## Pracovný postup ladenia a kalibrácie

1. Polož kocku na anténu a pripoj sa k doske.
2. Klikni **Auto-DPC sweep**. Tuner ide z 100 % dole: pri každej kolízii
   okamžite ubere, potom hľadá dolnú hranu čítania a nakoniec overí
   odporúčaný výkon (dolná hrana + 3 % rezerva, nikdy nad stropom).
3. Ak chceš, dolaď posuvníkom. Zelený chip *„1 tag v poli“* = presne to, čo
   chceš. Červené varovanie = pole zasahuje bočné steny.
4. Klikni **Spustiť párovanie steny**. Aplikácia počká na jediný stabilný UID.
5. Na 3D modeli klikni na stenu jadra, ktorá leží dole. UID sa naviaže na stenu,
   dopočíta sa hodnota hore a profil sa uloží.
6. Otoč kocku a zopakuj pre všetkých šesť stien → **Export JSON**.

Ukážka výsledného profilu (plná schéma v [docs/PROTOCOL.md](docs/PROTOCOL.md)):

```json
{
  "schema": "nfc-dice-profile/1",
  "name": "Kocka 01",
  "rf": { "tunedPowerPct": 27, "ceilingPct": 45, "lowEdgePct": 24 },
  "bindings": [
    { "face": "ny", "uid": "04:1A:7C:2B:5E:41:80", "value": 6, "topValue": 1 }
  ]
}
```

---

## Štruktúra repozitára

```
firmware/
  include/config.h          piny, RF limity, parametre DPC, sieť
  include/pn5180_defs.h     príkazy a registre PN5180 (jediné miesto s bitmi)
  include/dice_math.h       čistá logika (testovaná natívne)
  src/PN5180.cpp            SPI + BUSY handshake, registre, EEPROM, RF on/off
  src/Iso14443a.cpp         REQA, bit-frame anticollision, SELECT, HALT
  src/RfPower.cpp           0..100 % → RF_CONTROL_TX (+ externý atenuátor)
  src/DpcTuner.cpp          neblokujúci automat coarse → fine → verify
  src/DiceLink.cpp          WebSocket server, mDNS, HTTP health, USB zrkadlo
  src/main.cpp              skenovacia smyčka, presence tracking, príkazy
  test/                     natívne unit testy (pio test -e native)

client/
  src/lib/protocol.ts       typy rámcov + parser (zdieľané s firmwarom)
  src/lib/dice.ts           geometria, bodky, 7 − dole
  src/lib/profile.ts        kalibračný profil, export/import, localStorage
  src/lib/transports/       WebSocket | Web Serial | simulátor
  src/hooks/useDeviceLink   spojenie, telemetria, throttling posuvníka
  src/hooks/useCalibration  stavový automat párovania
  src/components/           Connection, DPC Tuner, UID log, kalibrácia, stats
  src/three/                DiceViewer, CoreCube, GlassShell, Pips
  src-tauri/                Windows shell (voliteľný)

docs/                       ARCHITECTURE.md · HARDWARE.md · PROTOCOL.md
```

---

## Testy a kontrola

```bash
cd firmware && pio test -e native     # logika DPC verdiktov, UID formát, 7 − dole
cd client   && npm run typecheck      # tsc --noEmit
cd client   && npm test               # vitest: dice, profil, protokol
cd client   && npm run build          # produkčný build
```

CI (`.github/workflows/ci.yml`) beží to isté plus kompiláciu firmwaru pre
`esp32-s3-devkitc-1`.

---

## Riešenie problémov

| Symptóm | Príčina / riešenie |
| --- | --- |
| `hello.reader.ok = false`, „EEPROM read failed“ | zapojenie SPI alebo chýbajúci **BUSY** pin; skráť drôty, over 3V3 aj 5 V |
| Kolízia aj pri minimálnom výkone | anténa je príliš blízko bočným stenám – zvýš vzdialenosť, alebo osaď externý atenuátor (`PIN_EXT_ATTENUATOR`) |
| „žiadny tag – polož kocku na čítačku“ | sweep začal pod prahom spodného tagu; skús `startPct = 100` a skontroluj, či je RF pole zapnuté |
| Tag bliká `found`/`lost` | pracuješ na dolnej hrane; pridaj 2–3 % výkonu (rezervu robí `DPC_HEADROOM_PCT`) |
| Web Serial nie je v ponuke | podporuje ho len Chromium (Chrome/Edge) a vyžaduje HTTPS alebo `localhost` |
| 3D scéna je čierna | starý GPU driver / vypnutá HW akcelerácia v prehliadači |

---

## Ďalšie kroky

* Ukladanie doladeného výkonu do EEPROM PN5180, aby doska štartovala už naladená.
* Viacero profilov kociek v jednom UI (aktuálne je aktívny jeden).
* Zápis mapovania priamo do NTAG213 (užívateľská pamäť), aby bola kocka
  self-descriptive.

Licencia: [MIT](LICENSE). Zmeny: [CHANGELOG.md](CHANGELOG.md).
