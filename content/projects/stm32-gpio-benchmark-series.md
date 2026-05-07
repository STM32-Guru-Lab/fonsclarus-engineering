+++
title = 'STM32 GPIO & Performance Benchmark Series'
date = 2026-05-08T00:00:00+02:00
lastmod = 2026-05-08T00:00:00+02:00
description = 'Systematische Messreihe zum GPIO-Toggle-Verhalten auf STM32F103 und STM32F411. Drei Serien, sieben Beiträge — von HAL vs CMSIS über Compiler-Optimierungen bis zu FPU-Leistung und Flash-Verbrauch.'
tags = ['stm32', 'gpio', 'hal', 'cmsis', 'fpu', 'flash', 'performance', 'benchmark', 'embedded']
+++

## Worum es geht

Diese Messreihe untersucht das Laufzeit- und Speicherverhalten von STM32-Mikrocontrollern unter kontrollierten Bedingungen — mit reproduzierbaren Messaufbauten, dokumentierten Toolchain-Versionen und offengelegten Clock-Konfigurationen. Jeder Beitrag isoliert einen Aspekt (Toggle-Methode, CPU-Headroom, Compiler-Optimierung, Plattform-Unterschied, FPU, Flash-Verbrauch) und beziffert ihn in konkreten Zahlen.

Die Beiträge sind in drei thematische Serien gegliedert:

1. **STM32 GPIO unter der Lupe** (F103 @ 8 MHz HSI) — Grundlagen: Welche Toggle-Methode ist wie schnell, wie viel CPU-Zeit bleibt übrig, was bewirken MODE-Bits wirklich, und wie stark greift der Compiler ein?
2. **F1 vs F4** (STM32F103 vs STM32F411) — Plattformvergleich: Was bringt der Cortex-M4F mit ART Accelerator und FPU gegenüber dem Cortex-M3?
3. **Flash-Verbrauch** — Build-System-Vergleich: Was kostet der CubeMX/HAL-Komfort in Kilobytes?

<!--more-->

---

## Serie 1: STM32 GPIO unter der Lupe

Die vier Beiträge dieser Serie nutzen denselben Messaufbau: STM32F103RB @ 8 MHz HSI, `arm-none-eabi-gcc` 14.3.1, Logic Analyzer direkt am Pin PB8. Der gesamte Testcode besteht aus einer `while(1)`-Schleife ohne Interrupts oder Timer.

### 1.1 — HAL vs CMSIS GPIO-Toggle

{{< ref "/blog/stm32-hal-vs-cmsis-gpio-toggle" >}} · 2026-04-26

Drei Methoden, ein Pin, eine Schleife — der direkte Vergleich:

| Methode | Frequenz (-O2) | CPU-Zyklen |
|---------|---------------|------------|
| `HAL_GPIO_TogglePin()` | 200 kHz | 40 |
| `GPIOB->ODR ^= …` | 445 kHz | 18 |
| `GPIOB->BSRR = …` | **1,6 MHz** | **5** |

**Was du mitnimmst:**

- **BSRR ist 8× schneller als HAL** und 3,6× schneller als ODR-XOR — bei exakt gleichem Systemtakt.
- Der Overhead kommt nicht vom GPIO-Peripheral, sondern von Funktionsaufruf, Parameterprüfung und Abstraktionsschicht der HAL.
- ODR-XOR ist nicht atomar — unter Interrupts droht eine Race Condition. BSRR ist sicher.

---

### 1.2 — CPU-Headroom: Warum BSRR mehr CPU-Zeit übrig lässt

{{< ref "/blog/stm32-gpio-cpu-headroom" >}} · 2026-04-27

Nicht die Spitzenfrequenz zählt, sondern die freie CPU-Zeit bei einer gegebenen Zielfrequenz. Für ein 200-kHz-Signal (20 CPU-Zyklen pro Halbperiode):

| Methode | CPU-Auslastung | Freie Zyklen |
|---------|:-------------:|:------------:|
| HAL     | **100 %**     | 0 |
| ODR-XOR | 45 %          | 11 |
| BSRR    | **12,5 %**    | 17,5 |

**Was du mitnimmst:**

- **Mit BSRR bleiben 87,5 % der CPU für die eigentliche Anwendung frei.**
- HAL ist bei 200 kHz bereits am Limit — jeder zusätzliche Rechenbefehl senkt die Frequenz.
- BSRR vergrößert den Headroom-Spielraum gegenüber HAL um fast das Achtfache.

---

### 1.3 — Output Speed: Was die MODE-Bits wirklich bewirken

{{< ref "/blog/stm32-gpio-output-speed" >}} · 2026-04-29

Die GPIO-Output-Speed-Einstellung wird oft mit der maximalen Toggle-Frequenz verwechselt. Die Messung zeigt:

| Methode (-O2) | Low Speed | Medium Speed | High Speed |
|---------------|:---------:|:------------:|:----------:|
| HAL           | ~200 kHz  | ~200 kHz     | ~200 kHz   |
| ODR-XOR       | ~445 kHz  | ~445 kHz     | ~445 kHz   |
| BSRR          | ~1,6 MHz  | ~1,6 MHz     | ~1,6 MHz   |

**Was du mitnimmst:**

- **Die MODE-Bits sind kein Turbo-Schalter für die Software.** Die Toggle-Frequenz bleibt über alle drei Einstellungen identisch.
- Die MODE-Bits steuern die **Flankensteilheit** des Ausgangstreibers — sie beeinflussen Signalqualität, Überschwinger und EMV-Verhalten.
- „Alle Pins auf High Speed" kann die EMV verschlechtern, ohne die Software schneller zu machen.

---

### 1.4 — Compiler-Optimierungen sichtbar gemacht

{{< ref "/blog/stm32-gpio-compiler-optimizations" >}} · 2026-04-29

15 Build-Varianten (3 Methoden × 5 Optimierungsstufen), ausgewertet mit Logic Analyzer und `arm-none-eabi-objdump`:

| Methode | `-O0` | `-Og` | `-O1` | `-O2` | `-Os` |
|---------|:-----:|:-----:|:-----:|:-----:|:-----:|
| HAL     | 80 kHz | 190 kHz | 222 kHz | 200 kHz | 211 kHz |
| ODR-XOR | 308 kHz | 364 kHz | 444 kHz | 444 kHz | 444 kHz |
| BSRR    | 615 kHz | 889 kHz | 1,6 MHz | 1,6 MHz | **2,0 MHz** |

**Was du mitnimmst:**

- **BSRR profitiert massiv von `-O2`: Faktor 3,7× gegenüber `-O0`.** Der Schleifenkörper schrumpft von 8 auf 3 Instruktionen.
- Constant Hoisting (Konstanten aus der Schleife ziehen) und Register Allocation sind die dominanten Hebel.
- `-O1` schlägt manchmal `-O2` (HAL: 222 vs 200 kHz) — Optimierung ist kein linearer Prozess.
- `assert_param()` erzeugt nur Code, wenn `USE_FULL_ASSERT` definiert ist.
- Ohne LTO wird `HAL_GPIO_TogglePin()` aus einer anderen .c-Datei nicht geinlined.

---

## Serie 2: F1 vs F4

Plattformvergleich zwischen STM32F103RB (Cortex-M3, 72 MHz max) und STM32F411RE (Cortex-M4F, 100 MHz max, mit ART Accelerator und FPU).

### 2.1 — GPIO-Toggle bei maximalem Systemtakt

{{< ref "/blog/stm32-f1-vs-f4-gpio-toggle" >}} · 2026-05-06

| Methode | F103 @ 72 MHz `-O0` | F103 @ 72 MHz `-O2` | F411 @ 100 MHz `-O0` | F411 @ 100 MHz `-O2` |
|---------|:-------------------:|:-------------------:|:--------------------:|:--------------------:|
| HAL     | 561 kHz | 1,13 MHz | 1,15 MHz | 3,18 MHz |
| ODR-XOR | 1,50 MHz | 3,28 MHz | 5,07 MHz | 8,45 MHz |
| BSRR    | 2,78 MHz | 10,3 MHz | 8,46 MHz | **25,34 MHz** |

**Was du mitnimmst:**

- **Der reine Taktvergleich (100/72 = 1,39×) greift viel zu kurz.** Real erreicht der F411 Speedup-Faktoren von 2,46–3,37× je nach Methode und Optimierung.
- Der **ART Accelerator** des F411 kann Flash-Latenzen so gut verdecken, dass bei BSRR `-O2` nur 4 Zyklen pro Toggle-Zyklus gemessen werden — weniger als die 5-Zyklen-Baseline des F103 bei 8 MHz ohne Waitstates.
- Der F103 leidet unter **Flash-Waitstates** (2 WS bei 72 MHz): Die Zyklenzahl steigt gegenüber 8 MHz um 20–60 %.
- **Compiler-Optimierung lohnt sich auf beiden Plattformen**, aber mit plattformabhängigen Unterschieden.

---

### 2.2 — FPU vs NoFPU: Gleitkomma-Leistung im Vergleich

{{< ref "/blog/stm32-f1-vs-f4-fpu" >}} · 2026-05-07

Ein einfacher Gleitkomma-Benchmark (20.000 Multiplikationen, Divisionen und Additionen) zeigt den fundamentalen Unterschied:

| Konfiguration | Laufzeit | Durchsatz |
|---------------|----------|-----------|
| F103 @ 72 MHz `-O2` (kein FPU) | 272 ms | 3,7 Hz |
| F411 @ 100 MHz `-O2` (Soft-Float) | 250 ms | 4,0 Hz |
| F411 @ 72 MHz `-O0` (HW-Float) | 29,4 ms | 34 Hz |
| **F411 @ 100 MHz `-O2` (HW-Float)** | **9,7 ms** | **103 Hz** |

**Was du mitnimmst:**

- **Ohne FPU ist Gleitkomma langsam und Compiler-Optimierung hilft kaum** — die Software-Emulation benötigt Hunderte Integer-Instruktionen pro `float`-Operation.
- **Mit FPU wird Gleitkomma schnell**: Faktor 8,9–18,3× allein durch Einschalten der Hardware-FPU.
- **Der Compiler wird mit FPU relevant:** Ohne FPU nur 1–5 % Gewinn durch `-O2`, mit FPU 117 %.
- **Taktskalierung ist mit FPU nahezu ideal** (100/72 MHz = 1,39× wird exakt erreicht), anders als beim GPIO-Toggle, wo Flash-Waitstates bremsen.
- **Maximaler Spread: 29,5×** — F411 mit HW-Float, 100 MHz, `-O2` vs F103 mit 72 MHz, `-O2`.
- Für alle Anwendungen mit `float`-Arithmetik (Signalverarbeitung, Filter, PID-Regler, Sensorfusion) ist die FPU ein entscheidendes Auswahlkriterium.

---

## Serie 3: Flash-Verbrauch

### 3.1 — CubeMX/HAL vs Minimal-CMSIS: der Preis des Komforts

{{< ref "/blog/stm32-cubeide-vs-cmake-cmsis" >}} · 2026-05-08

`arm-none-eabi-size`-Analyse von sechs Build-Varianten auf dem STM32F103RB:

| Konfiguration | Flash | vs Minimal-CMSIS `-Os` |
|---------------|-------|------------------------|
| CubeMX-HAL `-O0` | 4620 Byte | 5,6× größer |
| CubeMX-HAL `-Os` | 2888 Byte | 3,5× größer |
| CubeMX-BSRR `-Os` | 2872 Byte | 3,5× größer |
| **Minimal-CMSIS `-Os`** | **824 Byte** | Referenz |

**Was du mitnimmst:**

- **Die GPIO-Methode selbst ist für den Flash-Verbrauch irrelevant** — 16–44 Byte Unterschied zwischen HAL und BSRR im selben CubeMX-Projekt.
- **Der CubeMX/HAL-Sockelbetrag liegt bei ~2800 Byte** (Startup-Code, Vektortabelle, HAL-Init, Clock-Konfiguration, HAL-Tick-Infrastruktur).
- **CMake selbst spart keinen Flash.** Der Gewinn entsteht, weil im Minimalprojekt weniger Code eingebunden wird.
- Auf einem STM32F103RB (128 KB Flash) sind 2,9–4,6 KB Overhead kaum relevant. Auf einem 16-KB-Derivat kosten sie bereits 28 % des Budgets.
- **HAL ist nicht „schlecht" — HAL hat einen Preis.** Der Komfort kauft Entwicklungszeit, Portabilität und Reproduzierbarkeit.

---

## Quick-Reference: Alle Beiträge auf einen Blick

| # | Beitrag | Serie | Datum | Kernaussage |
|---|---------|-------|-------|-------------|
| 1 | [HAL vs CMSIS GPIO-Toggle]({{< ref "/blog/stm32-hal-vs-cmsis-gpio-toggle" >}}) | GPIO | 26.04. | BSRR 8× schneller als HAL (1,6 MHz vs 200 kHz) |
| 2 | [CPU-Headroom]({{< ref "/blog/stm32-gpio-cpu-headroom" >}}) | GPIO | 27.04. | BSRR lässt 87,5 % CPU frei; HAL bei 200 kHz am Limit |
| 3 | [Output Speed]({{< ref "/blog/stm32-gpio-output-speed" >}}) | GPIO | 29.04. | MODE-Bits ≠ Turbo; steuern Flanke & EMV |
| 4 | [Compiler-Optimierungen]({{< ref "/blog/stm32-gpio-compiler-optimizations" >}}) | GPIO | 29.04. | `-O0` → `-O2`: BSRR 3,7× schneller; Constant Hoisting |
| 5 | [F1 vs F4 GPIO-Toggle]({{< ref "/blog/stm32-f1-vs-f4-gpio-toggle" >}}) | F1 vs F4 | 06.05. | F411 25,34 MHz BSRR; ART schlägt Waitstates |
| 6 | [F1 vs F4 FPU]({{< ref "/blog/stm32-f1-vs-f4-fpu" >}}) | F1 vs F4 | 07.05. | 29,5× Spread; FPU essentiell für float |
| 7 | [Flash-Verbrauch]({{< ref "/blog/stm32-cubeide-vs-cmake-cmsis" >}}) | Flash | 08.05. | 5,6× weniger Flash; Sockelbetrag ~2800 Byte |

---

## Key Takeaways über alle Serien

**Methodik:**

- Alle Messungen sind reproduzierbar: dokumentierte Toolchain-Versionen, offengelegte Clock-Konfiguration, Logic-Analyzer-Aufnahmen.
- Die Toolchain ist einheitlich: `arm-none-eabi-gcc` 14.3.1, CubeMX 6.17.0, STM32CubeF1 HAL V1.8.7.

**Performance:**

- **BSRR ist in jedem Szenario die schnellste GPIO-Methode** — auf F103 und F411, bei 8 MHz und 100 MHz, mit `-O0` und `-Os`.
- **Der Compiler ist ein massiver Hebel:** Zwischen `-O0` und `-O2` liegen Faktoren von 2× bis 4×, abhängig von Methode und Plattform.
- **Flash-Waitstates bremsen den F103,** der ART Accelerator beschleunigt den F411 — der Plattformunterschied geht weit über das reine MHz-Verhältnis hinaus.
- **Die FPU vervielfacht den Gleitkomma-Durchsatz um das 10–30-fache** und macht den Compiler-Optimierungen den Weg frei.

**Speicher:**

- Der CubeMX/HAL-Komfort kostet ~2800 Byte Sockelbetrag — auf 128-KB-Chips irrelevant, auf 16-KB-Derivaten kritisch.
- Wechsel auf ein Minimal-CMSIS-Projekt spart bis zu 82 % Flash, erfordert aber eigenen Startup-Code und Build-System.

**Embedded Engineering:**

- Nicht jede Einstellung, die „schnell" heißt, macht die Software schneller — MODE-Bits steuern die Flanke, nicht die Frequenz.
- Die Wahl der GPIO-Methode ist eine Entscheidung zwischen maximaler Performance (BSRR), Einfachheit (HAL) und Portabilität.
- **Abstraktion hat einen Preis** — ob er sich lohnt, hängt vom Flash-Budget, den Echtzeitanforderungen und dem Projekttyp ab.
