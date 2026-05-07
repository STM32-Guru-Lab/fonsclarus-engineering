---
title: "Artikel-Ideen & Entwürfe"
draft: true
build:
  list: never
  render: never
---

# Notizen
1. Toolchain-Version dokumentieren
   arm-none-eabi-gcc --version

2. Buildflags vollständig dokumentieren
   -mcpu, -mthumb, -O2, -Os, -mfloat-abi, -mfpu, -ffunction-sections, Linkerflags

3. Clock-Konfiguration dokumentieren
   HSI/HSE/PLL, Flash-Latency, Prescaler

4. Disassembly ergänzen
   besonders bei HAL-Inlining, BSRR-Schleifen, FPU hard/soft

5. Rohdaten als CSV sichern
   Board, Takt, Methode, Optimierung, Frequenz, Zyklen, Flash

6. Messunsicherheit grob angeben
   Oszi/LA, Tastkopf, Trigger, Bandbreite, Rundung

7. Same-Clock-Vergleich nachreichen
   F103 und F411 bei gleichem Takt, soweit sinnvoll möglich