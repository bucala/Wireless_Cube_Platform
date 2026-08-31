# Hardvér a zapojenie

## Zoznam komponentov

| Časť | Typ | Poznámka |
| --- | --- | --- |
| MCU | ESP32-S3-WROOM-1 **N16R8** | 16 MB QIO flash, 8 MB OPI PSRAM |
| NFC front end | NXP **PN5180** modul | 13,56 MHz, ISO/IEC 14443-A, hardvérové SPI |
| Tagy | **NTAG213**, kruhové inlaye ⌀5 mm | 6 ks, zalité v jadre kocky |
| Kocka | jadro 7,5 mm (nepriehľadné) + obal 12 mm (priesvitný) | tag v strede každej steny jadra |
| Napájanie | 5 V / min. 1 A | PN5180 má špičky pri zapnutí nosnej |

## Zapojenie SPI

Predvolené piny sú v `firmware/include/config.h` – zámerne obchádzajú
strapping piny (0, 3, 45, 46) a USB piny (19, 20) ESP32-S3.

| PN5180 | ESP32-S3 GPIO | Smer | Poznámka |
| --- | --- | --- | --- |
| SCK | 12 | → | FSPI CLK |
| MISO | 13 | ← | |
| MOSI | 11 | → | |
| NSS | 10 | → | CS ovládaný softvérovo |
| BUSY | 9 | ← | **povinný**, celý handshake je na ňom postavený |
| RST | 8 | → | aktívny v L |
| IRQ | 7 | ← | voliteľný, firmware inak pollingom číta `IRQ_STATUS` |
| 5 V | 5 V | | vlastná vetva, nie z USB dátového pinu |
| 3V3 | 3V3 | | logika modulu |
| GND | GND | | spoločná zem, krátke spoje |

Voliteľne:

* `PIN_STATUS_LED = 48` – WS2812 na väčšine devkitov, svieti keď je tag v poli.
* `PIN_EXT_ATTENUATOR = -1` – GPIO, ktorý prepína sériový RF atenuátor. Ak ho
  osadíš, nastav číslo pinu a spodná časť rozsahu (pod ~15 %) získa rozlíšenie,
  ktoré samotné registre PN5180 už neponúkajú.

## Poznámky k RF časti

* SPI beží na 7 MHz (maximum host interface PN5180). Drôtiky drž pod ~10 cm,
  inak sa BUSY handshake stáva nespoľahlivým.
* Anténa PN5180 modulu je naladená na väčšie karty. Pre 5 mm tagy platí, že
  **užitočný pracovný rozsah je v spodnej štvrtine výkonu** – preto celý koncept
  DPC.
* Kovové predmety v okolí (stôl s plechom, notebook) posúvajú AGC aj prahy.
  Kalibruj na tej istej podložke, na ktorej sa bude hrať.

## Geometria a fyzika problému

```
        ┌──────────── 12 mm sklo (bodky 1..6) ────────────┐
        │        ┌──── 7,5 mm jadro (nepriehľadné) ────┐  │
        │        │  ⌀5 mm NTAG213 v strede každej stene │  │
        │        └──────────────────────────────────────┘  │
        └────────────────────────────────────────────────┘
                       ▲ 0 mm od antény = spodný tag
```

Keď kocka leží na čítačke:

| Tag | Vzdialenosť od antény | Prah čítania (typicky) |
| --- | --- | --- |
| spodná stena | ~0 mm | nízky (jednotky až ~20 %) |
| 4 bočné steny | 4–5 mm | stredný (~50–65 %) |
| vrchná stena | ~7,5 mm | vysoký (>80 %) |

Cieľ ladenia: nájsť okno medzi prahom spodného tagu a najnižším prahom bočných
stien. Firmware ho hľadá automaticky (`firmware/src/DpcTuner.cpp`), UI ho vie
nastaviť aj ručne posuvníkom.

## Ako firmware mení výkon

`RfPower` (v `firmware/src/RfPower.cpp`) mapuje 0–100 % na analógovú TX časť:

1. `LOAD_RF_CONFIG(0x00, 0x80)` nahrá z EEPROM konfiguráciu pre ISO14443-A
   106 kbit/s (tá prepíše aj `RF_CONTROL_TX`).
2. Firmware si po každom `LOAD_RF_CONFIG` uloží baseline registra a potom
   prepisuje dve polia:
   * `TX_CW_AMPLITUDE` (`RF_CONTROL_TX[7:5]`) – hrubá amplitúda budiča,
   * `TX_RESIDUAL_CARRIER` (`RF_CONTROL_TX[4:0]`) – jemný trim.
3. Pod ~15 % sa (ak je osadený) pridá externý atenuátor.

Percentá **nie sú kalibrované A/m**, je to monotónna a reprodukovateľná stupnica.
Tuner nepotrebuje absolútnu hodnotu, potrebuje monotónnosť. Ak chceš absolútne
čísla, premeraj pole referenčnou sondou a doplň si tabuľku v `mapPercent()`.

> Pozíciu bitových polí registrov ber podľa dátasheetu tvojej revízie PN5180
> (`firmware/include/pn5180_defs.h` je jediné miesto, kde sú definované).
