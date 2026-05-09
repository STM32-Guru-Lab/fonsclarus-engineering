+++
title = 'STM32 GPIO unter der Lupe: LTO — wenn der Compiler über Dateigrenzen hinweg optimiert'
date = 2026-05-09T00:00:00+02:00
description = 'LTO (Link-Time Optimization) auf dem STM32F103: Was bringt -flto beim GPIO-Toggle? Die Messung zeigt: HAL profitiert massiv (+54 %), ODR und BSRR bleiben unverändert. Die Disassembly-Analyse erklärt, warum.'
tags = ['stm32', 'gpio', 'compiler', 'lto', 'optimization', 'performance', 'embedded', 'c']
draft = false
+++

Der [vorherige Beitrag dieser Serie]({{< ref "/blog/stm32-gpio-compiler-optimizations" >}}) hat gezeigt, wie stark die Wahl der GCC-Optimierungsstufe die Toggle-Frequenz beeinflusst — von 80 kHz (HAL `-O0`) bis 2,0 MHz (BSRR `-Os`). Eine entscheidende Einschränkung blieb dabei bestehen: `HAL_GPIO_TogglePin()` liegt in einer separaten Übersetzungseinheit (`stm32f1xx_hal_gpio.c`), und ohne {{< gloss "LTO" >}} kann der Compiler nicht über Dateigrenzen hinweg optimieren. Der `bl`-Aufruf blieb in der bisherigen Messreihe erhalten — selbst bei `-O2`.

Dieser Beitrag schließt diese Lücke. Derselbe Testcode, dieselbe Hardware, aber diesmal mit **Link-Time Optimization** (`-flto`) kompiliert. Was passiert, wenn GCC beim Link-Schritt den zuvor gespeicherten Zwischencode über alle Übersetzungseinheiten hinweg auswertet und optimiert?

<!--more-->

## Testaufbau

Der Aufbau ist identisch zu allen vorherigen Beiträgen dieser Serie:

| Board         | Mikrocontroller | Takt                        |
| ------------- | --------------- | --------------------------- |
| Nucleo-F103RB | STM32F103RB     | 8 MHz ({{< gloss "HSI" >}}) |
| Bluepill      | STM32F103C6T6   | 8 MHz (HSI)                 |

Getestet werden alle drei Toggle-Methoden (HAL, {{< gloss "ODR" >}}-XOR, {{< gloss "BSRR" >}}) bei `-O2` — jeweils ohne und mit `-flto`. Die Messung erfolgt mit einem Logic Analyzer direkt am Pin PB8.

> ℹ️ **Messgerät:** Für die Frequenzmessung ist ein Logic Analyzer ausreichend — die Periodendauer lässt sich präzise erfassen. Die Signalqualität (Flankensteilheit, {{< gloss "Overshoot" >}}, {{< gloss "Ringing" >}}) kann der Logic Analyzer nicht bewerten; dafür wäre ein Oszilloskop nötig.

### Toolchain & Versionen

| Komponente | Version |
|------------|---------|
| `arm-none-eabi-gcc` | 14.3.1 (GNU Tools for STM32 14.3.rel1.20251027) |
| `arm-none-eabi-size` | 2.44.0.20250616 (GNU Tools for STM32) |
| `arm-none-eabi-objdump` | 2.44.0.20250616 (GNU Tools for STM32) |
| CMake | 3.28.3 |
| CubeMX | 6.17.0 |
| CubeIDE | 2.1.0 |
| STM32CubeF1 HAL | Firmware Package V1.8.7 |

### Clock-Konfiguration (NucF1_00_GPIO_Toggle)

Die vollständige Clock-Konfiguration (HSI, PLL, Taktraten, Flash-Latency) ist im [ersten Beitrag dieser Serie]({{< ref "/blog/stm32-hal-vs-cmsis-gpio-toggle#clock-konfiguration-nucf1_00_gpio_toggle" >}}) dokumentiert. Kurzfassung: SYSCLK = 8 MHz via PLL (HSI_DIV2 × 2), Flash-Latency 0 Waitstates.

### Build-Konfiguration

| Flag | Ohne LTO | Mit LTO |
|------|----------|---------|
| `-O2` | ✓ | ✓ |
| `-flto` | — | ✓ |
| `-ffunction-sections` | ✓ | ✓ |
| `-fdata-sections` | ✓ | ✓ |
| `--gc-sections` (Linker) | ✓ | ✓ |

> ⚠️ **Wichtig:** `-flto` muss sowohl als **Compile-Flag** (`CFLAGS`) als auch als **Link-Flag** (`LDFLAGS`) gesetzt werden. Nur im Compile-Schritt allein reicht nicht aus. GCC legt zwar LTO-Zwischencode in den `.o`-Dateien ab, aber ohne `-flto` beziehungsweise ein aktiviertes LTO-Plugin im Link-Schritt findet keine linkzeitige Optimierung über Übersetzungseinheiten hinweg statt.

## Messergebnisse: LTO vs kein LTO

| Methode | `-O2` ohne LTO | `-O2` mit LTO | Änderung |
| :------ | :------------: | :-----------: | :------: |
| **HAL** | 200,0 kHz | **307,7 kHz** | **+54 %** |
| **ODR-XOR** | 444,4 kHz | 444,4 kHz | ≈ 0 % |
| **BSRR** | 1,6 MHz | 1,6 MHz | ≈ 0 % |

Auf den ersten Blick ein klares Bild: LTO bringt nur bei HAL etwas. Bei ODR und BSRR ändert sich die gemessene Frequenz im Rahmen der Messgenauigkeit nicht. Die `objdump`-Analyse zeigt, warum.

<figure style="text-align: center">
  <img src="HAL_O2_LTO.jpg" alt="Logic-Analyzer-Aufnahme HAL bei -O2 mit LTO" />
  <figcaption>HAL_GPIO_TogglePin() bei <code>-O2</code> mit LTO: 307,7 kHz — statt 200 kHz ohne LTO</figcaption>
</figure>

## Disassembly-Analyse: Was LTO mit dem Code macht

### HAL — der einzige Profiteur

**Ohne LTO** besteht die `while(1)`-Schleife aus vier Instruktionen: Parameter laden, GPIOB-Adresse laden, Funktionsaufruf per `bl` und Rücksprung:

```text
  mov.w   r1, #256          @ GPIO_PIN_8
  ldr     r0, [pc, #8]      @ GPIOB = 0x40010C00
  bl      HAL_GPIO_TogglePin
  b.n     loop               @ Rücksprung
```

Der `bl`-Aufruf kostet Zyklen: Prologue, Epilogue, Sprungziel-Auflösung. Vor allem aber kann GCC den Funktionskörper nicht in die Optimierung einbeziehen — er liegt in einer anderen `.c`-Datei und ist zum Compile-Zeitpunkt unsichtbar.

**Mit LTO** wird der gesamte Funktionskörper von `HAL_GPIO_TogglePin()` für GCC beim Linken sichtbar. Der Compiler inlined die Funktion in `main()` und optimiert die entstehende Codesequenz. Das Ergebnis im `objdump` zeigt den geinlinten Toggle-Code direkt in der `while(1)`-Schleife:

```text
  while (1)
 8000490:  ldr     r3, [r1, #12]      @ r3 = GPIOB->ODR
           mvns    r2, r3              @ r2 = ~ODR
           lsls    r3, r3, #16         @ (ODR & PIN) << 16 (Bit in BR-Hälfte)
           and.w   r3, r3, #0x1000000  @ BR-Hälfte maskieren
           and.w   r2, r2, #0x100      @ (~ODR & PIN) = BS-Hälfte
           orrs    r3, r2              @ BSRR = BR | BS (ein Wert)
           str     r3, [r1, #16]       @ ein atomarer BSRR-Schreibzugriff
 80004a2:  b.n     8000490             @ repeat
```

**Beobachtungen aus dem Disassembly:**

- Kein `bl`-Aufruf mehr — `HAL_GPIO_TogglePin()` ist vollständig geinlined
- ODR wird gelesen (`ldr r3, [r1, #12]`)
- Der BSRR-Wert wird aus `(ODR & PIN) << 16 | (~ODR & PIN)` berechnet
- Genau **ein** BSRR-Schreibzugriff — kein Set/Reset-Paar wie bei der reinen BSRR-Methode
- 7 Instruktionen im geinlinten Hot Path — mehr sichtbare Instruktionen als die reine Aufrufschleife ohne LTO, aber der Funktionsaufruf samt HAL-Funktionskörper, Prologue/Epilogue und Rücksprung entfällt als separater Pfad

> 💡 **Erkenntnis:** LTO ist kein pauschaler Beschleuniger — es hilft nur dort, wo Code aus verschiedenen Übersetzungseinheiten zusammengeführt wird. Die gemessenen 54 % Toggle-Gewinn bei HAL entstehen dadurch, dass GCC beim Linken den Funktionskörper von `HAL_GPIO_TogglePin()` endlich „sehen" und inlinen kann. Dass der geinlinte Loop mehr sichtbare Instruktionen hat und trotzdem schneller ist, zeigt, wie teuer der entfallende Funktionsaufruf (inkl. Prologue/Epilogue und Register-Save/Restore) im Vergleich zu zusätzlichen ALU-Operationen ist.

### ODR-XOR — kein Funktionsaufruf, kein Gewinn

Die ODR-Schleife enthält von vornherein keinen Funktionsaufruf — nur direkte Registerzugriffe. LTO findet hier nichts zu inlinen:

```text
  ldr     r2, [pc, #12]     @ r2 = &GPIOB
  ldr     r3, [r2, #12]     @ r3 = GPIOB->ODR
  eor.w   r3, r3, #256      @ r3 ^= 0x100 (toggle)
  str     r3, [r2, #12]     @ GPIOB->ODR = r3
  b.n     loop
```

In dieser Messung zeigt die Disassembly mit und ohne LTO denselben Hot Path. Die gemessene Frequenz bleibt bei 444,4 kHz — der Compiler hatte bereits bei `-O1` das Optimum für diese Codesequenz gefunden.

### BSRR — praktisch am Minimum

Auch BSRR profitiert nicht von LTO. Die Drei-Instruktionen-Schleife liegt für diesen softwaregetriebenen Set/Reset-Toggle praktisch am Minimum: zwei beobachtbare `volatile` Store-Zugriffe auf BSRR und ein Rücksprung:

```text
  str     r1, [r3, #16]     @ BSRR = 0x100 → PIN HIGH
  str     r2, [r3, #16]     @ BSRR = 0x1000000 → PIN LOW
  b.n     loop
```

Kein Funktionsaufruf, keine Parameterübergabe, keine XOR-Operation — nur zwei Store-Instruktionen und ein Branch. LTO kann hier nichts optimieren, weil nichts zu optimieren ist. Die gemessene Frequenz bleibt bei 1,6 MHz.

## Was LTO wirklich macht — und was nicht

Die Ergebnisse dieser Messung räumen mit zwei häufigen Missverständnissen auf:

**1. „LTO macht alles schneller."** — Falsch. LTO beschleunigt nur Code, der über Übersetzungseinheiten hinweg optimiert werden kann. Reine Registerzugriffe wie ODR und BSRR sehen in dieser Messung keinen Unterschied. LTO ist kein zweiter `-O2`-Boost, sondern eine Ergänzung, die dort wirkt, wo die normale Optimierung an Dateigrenzen scheitert.

**2. „Mit LTO wird HAL genauso schnell wie CMSIS."** — Falsch. Selbst mit LTO erreicht HAL 307,7 kHz — weniger als ODR (444 kHz) und weit weniger als BSRR (1,6 MHz). Der `bl`-Overhead ist nur ein Teil des HAL-Overheads. Auch nach dem Inlining bleiben die Toggle-Logik (ODR Lesen → BSRR-Maske berechnen → BSRR schreiben) und die GPIO-Strukturzugriffe erhalten. LTO verkleinert den Abstand, schließt ihn aber nicht.

## Flash-Verbrauch mit LTO

In dieser Messung stieg der Flash-Verbrauch mit LTO um ca. 270 Byte an (ermittelt mit `arm-none-eabi-size` auf dem finalen ELF). Das ist ein realer Codegrößenzuwachs in der Firmware — nicht etwa LTO-Metadaten (GIMPLE-Bytecode) in `.o`-Dateien, die nicht in das Binary gelangen. Ob LTO die Codegröße erhöht oder reduziert, hängt vom Projekt ab: Bei vielen kleinen cross-TU-Funktionen kann LTO durch Inlining die Größe auch senken.

## Fazit

LTO auf dem STM32F103 ist ein gezieltes Werkzeug — kein Allheilmittel:

- **HAL profitiert deutlich (+54 %)** von LTO, weil `HAL_GPIO_TogglePin()` aus einer anderen `.c`-Datei endlich geinlined werden kann.
- **ODR und BSRR profitieren nicht**, weil sie keinen cross-TU-Funktionsaufruf enthalten. Die erzeugte Codesequenz ist mit und ohne LTO identisch.
Die Praxisempfehlung: LTO (`-flto`) ist eine sinnvolle Ergänzung zu `-O2`, wenn das Projekt viele Funktionsaufrufe über Übersetzungseinheiten hinweg enthält — typischerweise bei HAL-basiertem Code. Für reinen CMSIS-Code mit direkten Registerzugriffen bringt LTO in dieser Messung keinen Laufzeitvorteil. Die Entscheidung sollte auf Basis der eigenen Codebasis und des Flash-Budgets getroffen werden — LTO kann die Codegröße je nach Projekt sowohl erhöhen als auch reduzieren.


## Ausblick

In den nächsten Beiträgen dieser Serie könnten folgende Themen behandelt werden:

- **Interrupt-Latenz beim GPIO-Toggle**: Was passiert, wenn ein Interrupt die Toggle-Schleife unterbricht?
- **GPIO-Lesegeschwindigkeit**: Wie schnell kann der STM32F103 einen Pin einlesen (IDR)?
- **Zusammenfassung und Leitfaden**: Welche Methode für welchen Anwendungsfall?

## Video & Quellen

*TBD — Video und Quellcode folgen, sobald verfügbar.*

### Referenzierte Dokumente

- **GCC Optimize Options** — GCC-Dokumentation zu `-O0`, `-O1`, `-O2`, `-O3`, `-Os`, `-flto` und weiteren Optimierungen. [Online](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html)
- **GCC Link Time Optimization (LTO)** — GCC-Dokumentation zur Link-Time Optimization und Optimierung über Übersetzungseinheiten hinweg. [Online](https://gcc.gnu.org/onlinedocs/gccint/LTO.html)
- **GNU Binutils / objdump** — Dokumentation zu den GNU Binary Utilities, darunter `objdump`, `objcopy` und `size`. [Online](https://sourceware.org/binutils/docs/binutils/)
- **STM32CubeF1** — Offizielles STM32Cube-Paket für die STM32F1-Serie mit HAL/LL-Treibern, CMSIS und Beispielprojekten. [GitHub](https://github.com/STMicroelectronics/STM32CubeF1)
- **RM0008 Rev 21** — STM32F101xx, STM32F102xx, STM32F103xx, STM32F105xx, STM32F107xx Referenzhandbuch. [PDF](https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-arm-based-32-bit-mcus-stmicroelectronics.pdf)
