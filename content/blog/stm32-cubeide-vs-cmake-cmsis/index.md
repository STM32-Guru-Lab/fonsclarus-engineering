+++
title = 'Flash-Verbrauch: CubeMX/HAL vs Minimal-CMSIS — der Preis des Komforts'
date = 2026-05-08T00:00:00+02:00
description = 'Was passiert mit dem Flash-Verbrauch, wenn man CubeMX und HAL komplett hinter sich lässt? Ein Vergleich zwischen einem CubeMX-Komfortprojekt und einem schlanken CMSIS-Minimalprojekt — gemessen auf dem STM32F103RB.'
tags = ['stm32', 'cmsis', 'hal', 'cmake', 'cubemx', 'flash', 'optimization', 'embedded', 'c']
+++

Die [bisherigen Beiträge]({{< ref "/blog/stm32-hal-vs-cmsis-gpio-toggle" >}}) dieser Serie haben {{< gloss "HAL" >}} und {{< gloss "CMSIS" >}} unter Leistungsgesichtspunkten verglichen — Toggle-Frequenz, CPU-Headroom, Compiler-Effekte. Ein Aspekt kam dabei bislang nicht zur Sprache: **der Flash-Verbrauch**.

CubeMX generiert ein vollständiges Projektgerüst mit Startup-Code, Linker-Script, Systeminitialisierung, HAL-Basisinitialisierung und den für die Konfiguration eingebundenen HAL-Treibern. Das ist komfortabel, aber es hat seinen Preis in Kilobytes. Was passiert, wenn man diesen Komfort aufgibt und auf ein schlankes Minimalprojekt mit eigenem Startup-Code, CMake-Build und direkten CMSIS-Registerzugriffen wechselt?

Dieser Beitrag beziffert den Preis — auf dem STM32F103RB, mit sechs Build-Varianten.

<!--more-->

## Testaufbau

Zwei vollständig getrennte Build-Umgebungen werden auf demselben Mikrocontroller verglichen:

| Umgebung | Toolchain | Framework | Build-System | Anwendungscode |
|----------|-----------|-----------|--------------|----------------|
| **CubeMX** | `arm-none-eabi-gcc` | HAL + CMSIS-Header | CubeMX/Makefile | `HAL_GPIO_TogglePin()` / direkter BSRR-Zugriff |
| **Minimal-CMSIS** | `arm-none-eabi-gcc` | Nur CMSIS-Header | CMake | BSRR-Zugriff |

Gemeinsamkeiten beider Umgebungen:

- Mikrocontroller: **STM32F103RB** (Nucleo-F103RB)
- Compiler: `arm-none-eabi-gcc` (gleiche Toolchain)
- Kein {{< gloss "LTO" >}}

**Wichtiger methodischer Hinweis:** Dieser Vergleich ist bewusst ein Extremvergleich, kein vollständig funktionsäquivalenter 1:1-Vergleich. Das CubeMX-Projekt initialisiert den Systemtakt über die {{< gloss "PLL" >}} auf 72&nbsp;MHz und nutzt die übliche HAL-Initialisierung (`HAL_Init`, `SystemClock_Config`, HAL-Tick-Infrastruktur). Das Minimal-CMSIS-Projekt bleibt für diesen ersten Flash-Vergleich im Reset-Zustand bei 8&nbsp;MHz {{< gloss "HSI" >}} und enthält keine PLL-Konfiguration. Der gemessene Unterschied enthält daher nicht nur HAL-Overhead, sondern auch den Codeanteil für Clock-Initialisierung und Projekt-Infrastruktur.

Dieser Beitrag betrachtet zunächst zwei Extrempunkte:

1. **CubeMX/HAL-Komfortprojekt:** vollständige HAL-Initialisierung, Clock-Konfiguration auf 72&nbsp;MHz, CubeMX-Projektstruktur.
2. **Minimal-CMSIS-Projekt:** eigener Startup-Code, CMSIS-Header, BSRR-Toggle, keine HAL, keine PLL-Konfiguration.

Ein späterer, fairerer Vergleich wäre: CubeMX/HAL bei 72&nbsp;MHz vs Minimal-CMSIS bei 72&nbsp;MHz mit eigener PLL-Konfiguration — dann lässt sich der reine HAL-/CubeMX-Sockelbetrag besser vom Clock-Konfigurationscode trennen.

Mit „Minimal-CMSIS" ist in diesem Beitrag gemeint: direkte Verwendung der STM32-CMSIS-Device-Header und Registerdefinitionen ohne HAL/LL-Treiber. CMSIS selbst ist kein Framework mit Runtime-Overhead; die Header liefern primär Typdefinitionen, Registerstrukturen und Bitmasken — sie erzeugen selbst keinen Code im Flash.

Das Minimal-CMSIS-Projekt steht als Open-Source-Referenz auf GitHub: [Nuc_00_Empty_CMSIS](https://github.com/STM32-Guru-Lab/00_YT_General/tree/main/Nuc_00_Empty_CMSIS).

### Messmethode

Die Flash- und RAM-Belegung wird in beiden Umgebungen mit `arm-none-eabi-size` aus der ELF-Datei ermittelt:

- **Flash** = `text` + `data`
- **RAM** = `data` + `bss`

Die RAM-Werte werden in diesem Beitrag nicht weiter ausgewertet, weil sie stark vom Linker-Script und der reservierten Stack-/Heap-Größe abhängen. CubeMX-Projekte reservieren typischerweise Bereiche für Stack und Heap, die in der Größenübersicht auftauchen können. Für diesen Beitrag steht der Flash-Verbrauch im Fokus.

## Messergebnisse

### CubeMX-Projekt — HAL-Toggle (`HAL_GPIO_TogglePin`)

| Optimierung | text | data | bss | Flash (text+data) |
|-------------|------|------|-----|---------------------|
| `-O0` | 4608 | 12 | 1572 | **4620** |
| `-Os` | 2876 | 12 | 1572 | **2888** |

→ `-Os`-Reduktion: **1,60×**

### CubeMX-Projekt — direkter BSRR-Zugriff im Anwendungscode

| Optimierung | text | data | bss | Flash (text+data) |
|-------------|------|------|-----|---------------------|
| `-O0` | 4564 | 12 | 1572 | **4576** |
| `-Os` | 2860 | 12 | 1572 | **2872** |

→ `-Os`-Reduktion: **1,59×**

### Minimal-CMSIS-Projekt (CMake)

| Optimierung | RAM | Flash |
|-------------|-----|-------|
| `-O0` | 1576 | **1256** |
| `-Os` | 1576 | **824** |

Für das Minimal-CMSIS-Projekt wird hier die vom Build ausgegebene Memory-Region-Auswertung gezeigt; die Flash-Werte entsprechen ebenfalls `text`+`data`.

→ `-Os`-Reduktion: **1,52×**

## Analyse: Was frisst den Flash?

### 1. HAL-Toggle vs BSRR innerhalb CubeMX: praktisch kein Unterschied

| Vergleich (CubeMX-Projekt) | `-O0` | `-Os` |
|-----------------------------|-------|-------|
| HAL-Toggle vs BSRR | 4620 vs 4576 | 2888 vs 2872 |
| Differenz | 44 Byte | 16 Byte |

> **Erkenntnis:** Die GPIO-Methode selbst ist für den Flash-Verbrauch irrelevant. Ob `HAL_GPIO_TogglePin()` oder `GPIOB->BSRR = …` — beides verschwindet im Rauschen des CubeMX-Projektgerüsts. Die 16–44 Byte Differenz sind der gesamte Beitrag der Toggle-Logik. Der Rest — knapp 2800 Byte auch bei `-Os` — ist der Sockelbetrag dieses CubeMX/HAL-Projekts: Startup-Code, Vektortabelle, `HAL_Init`, Clock-Konfiguration, GPIO-Initialisierung, SysTick/HAL-Tick-Infrastruktur und benötigte HAL-/CMSIS-Routinen.

### 2. Der CubeMX-Sockelbetrag: Was steckt in den ~2800 Byte?

Selbst bei aggressivster Optimierung (`-Os`) und minimalem Anwendungscode (nur ein GPIO-Toggle) liegen die CubeMX-Builds bei rund 2850–2890 Byte Flash. Dieser Sockelbetrag setzt sich zusammen aus:

- **Interrupt-Vektortabelle:** Mindestens die 16 Core-Exception-Einträge plus die device-spezifischen IRQ-Einträge des STM32. In einem typischen Startup-File ist die Tabelle daher größer als nur die 64 Byte der Core-Exceptions.
- **`HAL_Init()`:** Initialisiert den HAL-Timer (SysTick) und das NVIC-Priority-Grouping
- **`SystemClock_Config()`:** PLL-Konfiguration von HSE (8 MHz) auf 72 MHz — mehrere Registerzugriffe mit Wait-Status-Prüfung
- **`HAL_MspInit()`:** Hardware-Initialisierung auf MCU-Ebene
- **Startup-Code:** Stack-Pointer-Init, Datenkopie von Flash nach RAM, BSS-Nullung, Aufruf von `main()`
- **HAL-Bibliothekscode:** Nicht die Header selbst erzeugen den Flash-Verbrauch, sondern die eingebundenen und tatsächlich referenzierten HAL-Quellmodule und Funktionen. Dazu gehören in diesem Minimalbeispiel insbesondere `HAL_Init`, HAL_RCC-/Clock-Code, `HAL_GPIO_Init` bzw. `HAL_GPIO_TogglePin` sowie die HAL-Tick-/SysTick-Infrastruktur. Nicht referenzierte Funktionen können bei geeigneten Flags wie `-ffunction-sections`, `-fdata-sections` und `--gc-sections` vom Linker entfernt werden. Assert-Pfade erzeugen nur dann Code, wenn `USE_FULL_ASSERT` aktiviert ist — in vielen CubeMX-Projekten ist `assert_param()` ohne `USE_FULL_ASSERT` ein leeres Makro.

CubeMX ist nicht primär auf minimalen Flash-Verbrauch ausgelegt, sondern auf schnelle, reproduzierbare Projektkonfiguration. Es generiert ein robustes Projektgerüst mit Initialisierungscode, HAL-Struktur und Erweiterbarkeit.

> **Der Preis des Komforts:** Der Anwender zahlt diesen Komfort in Flash — in diesem Minimalbeispiel rund 2800 Byte. Das ist die Eintrittskarte für eine reproduzierbare, portable Projektbasis, die ohne manuellen Startup-Code und Registerkonfiguration auskommt.

### 3. Der Minimal-CMSIS-Ansatz: 824 Byte

Das Minimal-CMSIS-Projekt verzichtet auf das gesamte HAL-Framework und die PLL-Konfiguration. Was bleibt:

- Interrupt-Vektortabelle
- Minimaler Startup-Code (Stack, BSS, `main()`)
- CMSIS-Header (nur Typdefinitionen und Register-Makros — kein Code)
- Der BSRR-Toggle in `main()`

Das Ergebnis: **824 Byte** mit `-Os`. Das ist weniger als ein Drittel des CubeMX-`-Os`-Builds — allerdings bei bewusst reduziertem Funktionsumfang: kein HAL, keine PLL-Konfiguration, keine HAL-Tick-Infrastruktur und ein minimaler Startup-/Linker-Aufbau.

Interessant: Auch im Minimal-CMSIS-Projekt bringt `-Os` noch eine deutliche Reduktion (1256 → 824, Faktor 1,52). Relativ liegt dieser Effekt in einer ähnlichen Größenordnung wie bei den CubeMX-Builds (Faktor ~1,60). Absolut ist die Einsparung im Minimalprojekt kleiner (432 Byte vs. 1732 Byte), weil bereits bei `-O0` deutlich weniger Code vorhanden ist.

**CMake selbst spart keinen Flash.** Der Build-System-Wechsel ist nur der organisatorische Rahmen. Der eigentliche Flash-Gewinn entsteht dadurch, dass im Minimalprojekt weniger Code eingebunden wird: kein `HAL_Init`, keine HAL-Tick-Infrastruktur, keine `SystemClock_Config` und keine ungenutzten Projektbestandteile. Ein CMake-Projekt mit HAL wäre nicht automatisch kleiner.

### 4. Der maximale Spread: Faktor 5,6

| Vergleich | Flash | Faktor | Ersparnis |
|-----------|-------|--------|-----------|
| CubeMX HAL `-O0` | 4620 | — | — |
| CubeMX HAL `-Os` | 2888 | **1,60×** | 37,5 % |
| Minimal-CMSIS `-O0` | 1256 | **3,68×** (vs CubeMX `-O0`) | 72,8 % |
| **Minimal-CMSIS `-Os`** | **824** | **5,60×** (vs CubeMX `-O0`) | **82,2 %** |

> **Kernzahlen:** Der Extremfall: CubeMX-HAL-`-O0` (4620&nbsp;B) → Minimal-CMSIS-`-Os` (824&nbsp;B) = **Faktor 5,6× (−82,2 %)**. Der für die Praxis fairere Release-Vergleich: CubeMX-`-Os` (2888) → Minimal-CMSIS-`-Os` (824) = **Faktor 3,5× (−71,5 %)**. In beiden Fällen ist der relative Gewinn massiv — absolut bleiben es wenige Kilobyte, die auf einem 128-KB-Chip kaum ins Gewicht fallen, auf einem 16-KB-Derivat aber 28 % des Budgets ausmachen können.

## Fazit

Die konkreten Zahlen für den STM32F103RB auf einen Blick:

| Konfiguration | Flash | vs Minimal-CMSIS-`-Os` |
|---------------|-------|------------------------|
| CubeMX-HAL-`-O0` | 4620 Byte | 5,6× größer |
| CubeMX-HAL-`-Os` | 2888 Byte | 3,5× größer |
| **Minimal-CMSIS-`-Os`** | **824 Byte** | Referenz |

Der optimierte Release-Vergleich (`-Os` vs `-Os`) zeigt Faktor 3,5 — allerdings bei reduziertem Funktionsumfang (kein HAL, keine PLL-Konfiguration, keine HAL-Tick-Infrastruktur).

> **HAL ist nicht „schlecht" — HAL hat einen Preis.** Abstraktion, automatische Initialisierung und universelle Projektstruktur haben einen messbaren Sockelbetrag. Der kauft Entwicklungszeit, Portabilität und Reproduzierbarkeit. Ob dieser Sockelbetrag relevant ist, hängt vom Flash-Budget und vom Projekttyp ab. Auf einem STM32F103RB mit 128 KB Flash sind 2,9–4,6 KB Framework-Overhead kaum relevant. Auf kleinen Derivaten mit 16 KB Flash kosten sie bereits 28 % des Budgets — der Unterschied zwischen „passt" und „passt nicht".

Der Wechsel von CubeMX auf ein eigenes CMake-Projekt mit reinen CMSIS-Headern ist nicht ohne Aufwand: Linker-Script, Startup-Code, Clock-Konfiguration und das gesamte Build-System müssen selbst aufgesetzt werden. Aber der Flash-Gewinn ist in dieser Messung substanziell — **71–82 % weniger**, abhängig davon, ob der optimierte Release-Vergleich oder der Extremvergleich gegen `-O0` betrachtet wird.

## Ausblick

Dieser erste Vergleich betraf nur den STM32F103 — und war bewusst ein Extremvergleich zwischen „voller Komfort" und „minimaler Reset-State". Der nächste Schritt ist die gleiche Flash-Verbrauchsmessung auf dem STM32F411. Für den Flash-Verbrauch selbst spielt der ART Accelerator keine direkte Rolle, weil er die Ausführung aus dem Flash beschleunigt, aber die Codegröße nicht reduziert. Interessant ist hier eher, ob die F4-HAL, Startup-Dateien und Clock-Konfiguration einen anderen Sockelbetrag erzeugen als beim F103.

Für einen strengeren, funktionsäquivalenteren Vergleich folgt eine zweite Messreihe, in der das Minimal-CMSIS-Projekt ebenfalls die PLL auf 72&nbsp;MHz konfiguriert. Dann lässt sich der reine HAL-/CubeMX-Sockelbetrag besser vom Clock-Konfigurationscode trennen.

Zusätzlich stellt sich die Frage: Was bringt {{< gloss "LTO" >}} in beiden Umgebungen? Kann LTO den CubeMX-Overhead reduzieren, indem es über Übersetzungseinheiten hinweg optimiert, kleine HAL-Funktionen inline setzt und ungenutzte Codepfade innerhalb referenzierter Funktionen besser entfernt? Nicht referenzierte Funktionen können bereits ohne LTO durch `--gc-sections` entfernt werden, sofern `-ffunction-sections` und `-fdata-sections` aktiv sind. Und welche Symbole verschwinden beim Wechsel vom CubeMX- zum Minimal-CMSIS-Projekt konkret aus dem ELF? Ein Disassembly-Vergleich könnte diese Frage beantworten.

## Quellen

| Ressource | Link |
|-----------|------|
| Minimal-CMSIS-CMake-Projekt (Referenz) | [github.com/STM32-Guru-Lab/00_YT_General](https://github.com/STM32-Guru-Lab/00_YT_General/tree/main/Nuc_00_Empty_CMSIS) |
| CubeMX | [st.com](https://www.st.com/en/development-tools/stm32cubemx.html) |
| CMake | [cmake.org](https://cmake.org) |

### Referenzierte Dokumente

| Dokument | MCU | Link |
|----------|-----|------|
| **DS5319** | STM32F103x8/xB Datasheet | [st.com](https://www.st.com/resource/en/datasheet/stm32f103c8.pdf) |
| **RM0008** | STM32F103 Reference Manual | [st.com](https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) |
