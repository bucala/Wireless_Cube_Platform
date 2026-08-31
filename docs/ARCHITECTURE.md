# Architektúra

```
┌───────────────────────────── kocka 12 mm ─────────────────────────────┐
│ sklo s bodkami 1..6 │ jadro 7,5 mm │ 6× NTAG213 ⌀5 mm (stred stien)   │
└───────────────────────────────────────────────────────────────────────┘
                 ▼ 13,56 MHz
┌──────────────── ESP32-S3-WROOM-1 N16R8 (firmware/) ───────────────────┐
│ PN5180 (SPI 7 MHz, BUSY handshake)                                    │
│   └─ Iso14443a  … REQA + bit-frame anticollision + HALT → set UID     │
│   └─ RfPower    … 0..100 % → RF_CONTROL_TX (+ ext. atenuátor)         │
│   └─ DpcTuner   … coarse → fine → verify (nebl. stavový automat)      │
│ DiceLink                                                              │
│   └─ AsyncWebServer + AsyncWebSocket  /ws                             │
│   └─ zrkadlenie rámcov na USB CDC (newline JSON)                      │
│   └─ mDNS: nfc-dice.local, HTTP /api/health                           │
└───────────────────────────────────────────────────────────────────────┘
        ▲ JSON rámce (docs/PROTOCOL.md)               ▲
        │ WebSocket (Wi-Fi)                           │ Web Serial (USB)
┌───────┴─────────────────── client/ (React + Vite) ──┴──────────────────┐
│ transports: WsTransport | SerialTransport | SimTransport               │
│ useDeviceLink  … status, telemetria, throttling posuvníka, log         │
│ useCalibration … stavový automat párovania + profil kocky (JSON)       │
│ UI (TailwindCSS, dark): Connection · Signal & DPC Tuner · UID log      │
│ 3D (react-three-fiber): jadro + glass shell + klikateľné steny         │
└───────────────────────────────────────────────────────────────────────┘
                 ▼ voliteľne
        Tauri shell (client/src-tauri) → .msi / .exe pre Windows
```

## Firmware: tok jedného loop ticku

1. `Iso14443a::inventory()` – REQA, bit-frame anticollision, SELECT, HALT pre
   každý nájdený tag; vráti množinu UID + príznak kolízie + AGC.
2. `trackPresence()` – hranové udalosti `found` / `lost` s TTL 350 ms, aby jeden
   vypadnutý rámec na hranici poľa nespôsobil blikanie.
3. `DpcTuner::feed()` – ak beží sweep, výsledok posunie stavový automat.
4. `DiceLink::send()` – rámce `scan` / `tag` / `dpc` / `state` na WebSocket aj
   na sériový port.

Kľúčové rozhodnutie: **tuner je neblokujúci**. Sweep beží nad normálnou
skenovacou kadenciou, takže WebSocket zostáva responzívny a klient vidí každý
krok ladenia v reálnom čase.

## DPC algoritmus

```
coarse:  od štartovacieho výkonu dole po 5 %
         – kolízia (>1 UID) ⇒ okamžite o krok nižšie
         – 5 z 6 vzoriek = práve 1 UID ⇒ strop nájdený → fine
fine:    dole po 1 %, kým je čítanie stabilné ⇒ dolná hrana
verify:  dolná hrana + 3 % (najviac po strop; inak stred intervalu)
         – stabilné a bez kolízií ⇒ done
         – kolízia ⇒ o 1 % nižšie; výpadok ⇒ o 1 % vyššie
```

Parametre sú v `firmware/include/config.h` (`DPC_*`). Rovnaký automat má aj
simulátor v klientovi (`client/src/lib/transports/simTransport.ts`), takže sa dá
UI vyvíjať aj bez hardvéru.

## Klient: prečo tri transporty

| Transport | Kedy | Poznámka |
| --- | --- | --- |
| `WsTransport` | bežná práca | auto-reconnect s backoffom, buffering príkazov |
| `SerialTransport` | doska bez Wi-Fi credentials | Web Serial API, len Chromium |
| `SimTransport` | vývoj UI, demo, testy | model poľa s prahmi podľa vzdialenosti tagov |

Všetky tri implementujú rovnaké rozhranie `Transport`, takže hook
`useDeviceLink` ani UI o rozdieloch nevedia.

## Párovacia logika (3D)

1. Používateľ doladí výkon tak, aby v poli bol iba spodný tag.
2. Klikne **Spustiť párovanie steny** → `useCalibration` čaká na jediný stabilný
   UID (3 po sebe idúce potvrdenia, žiadna kolízia).
3. UI vyzve: *„Klikni na stenu jadra, ktorá leží dole“*. Sklenený obal má
   vypnutý raycasting, takže klik vždy dopadne na kliknuteľnú plochu jadra.
4. `bindFace()` uloží UID ↔ stena, dopočíta `topValue = 7 − value` a k profilu
   priloží aj RF nastavenia z posledného DPC sweepu.
5. Profil sa priebežne ukladá do `localStorage` a dá sa exportovať/importovať
   ako JSON (schéma `nfc-dice-profile/1`).

## Rozloženie repozitára

```
firmware/     PlatformIO projekt (ESP32-S3 + native testy čistej logiky)
client/       Vite + React + TS + Tailwind + react-three-fiber (+ Tauri shell)
docs/         architektúra, hardvér, protokol
.github/      CI: build firmwaru, typecheck, testy a build klienta
```
