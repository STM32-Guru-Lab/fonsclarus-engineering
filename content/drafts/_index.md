---
title: "Artikel-Ideen & Entwürfe"
draft: true
build:
  list: never
  render: never
---

# Notizen
+++
title = 'STM32 GPIO unter der Lupe: Warum BSRR mehr CPU-Zeit für Ihre Anwendung bedeutet'
date = 2026-05-05
description = 'Der Performance-Vergleich zwischen HAL, CMSIS-ODR und BSRR auf dem STM32F103 bei 8 MHz geht über die reine Toggle-Frequenz hinaus: Im Fokus steht, wie viel Rechenzeit nach dem Pin-Toggle für echte Aufgaben übrig bleibt.'
tags = ['stm32', 'gpio', 'hal', 'cmsis', 'bsrr', 'performance', 'embedded', 'cpu-utilization']
+++

HAL (Hardware Abstraction Layer) und direkte Registerzugriffe über CMSIS sind die beiden dominanten Programmiermodelle für STM32-Mikrocontroller. Eine Diskussion, die fast immer bei „maximaler Toggle-Frequenz“ stehen bleibt. Doch in der Praxis stellt sich eine viel wichtigere Frage: **Wie viel CPU-Zeit bleibt mir nach dem Pin-Umschalten für meine eigentliche Anwendung?**

Dieser Beitrag quantifiziert diesen Freiraum anhand eines reproduzierbaren Beispiels – eines einfachen GPIO-Toggles auf dem STM32F103 bei 8 MHz HSI-Takt. Die Oszilloskop-Messungen zeigen nicht nur die erreichbaren Frequenzen, sondern vor allem die minimalen CPU-Zyklen, die für einen einzigen Zustandswechsel investiert werden müssen. Daraus lässt sich ableiten, wie viele Zyklen bei einer vorgegebenen Signalfrequenz für Verarbeitungslogik übrig bleiben.

## Testaufbau

Die Messungen erfolgten auf zwei weit verbreiteten Boards, um die Unabhängigkeit von der Peripherie zu demonstrieren:

| Board | Mikrocontroller | Systemtakt |
|-------|----------------|-------------|
| Nucleo-F103RB | STM32F103RB | 8 MHz (HSI) |
| Bluepill | STM32F103C6T6 | 8 MHz (HSI) |

Beide Systeme laufen ausschließlich vom internen 8-MHz-RC-Oszillator (HSI), ohne PLL. Der gesamte Testcode besteht aus einer `while(1)`-Schleife, die den Pin PB8 umschaltet – ohne Interrupts, Timer oder andere Nebenläufigkeiten. Compiliert wurde mit GCC und der Optimierungsstufe `-O2`, die für die Praxis typisch ist. Ohne Optimierung (`-O0`) fallen die Frequenzen deutlich niedriger aus; die hier gezeigten Werte sind daher nur bei eingeschaltetem Optimizer gültig.

### Messmethode

Das Rechtecksignal wird direkt am GPIO-Pin (PB8) gegen Masse mit einem passiven Tastkopf und kurzer Massefeder (Ground Spring) abgegriffen. Die Feder vermeidet die bei höheren Frequenzen störende Schleifeninduktivität einer 10‑cm‑Masseleitung. Die Periodendauer des Signals liefert die gesuchte Toggle-Frequenz, aus der sich mit dem bekannten CPU-Takt von 8 MHz die benötigten Taktzyklen pro vollständigem Toggle-Zyklus (Low → High → Low) berechnen lassen:

$$N_{\text{Zyklen}} = \frac{f_{\text{CPU}}}{f_{\text{Toggle}}}$$

Diese Zyklenzahl ist das zentrale Maß für den „CPU-Verbrauch“ der jeweiligen Implementierung.

## Die drei Implementierungen

### 1. `HAL_GPIO_TogglePin` – Komfortabel, aber teuer

```c
while (1) {
    HAL_GPIO_TogglePin(GPIOB, GPIO_PIN_8);
}

Die HAL-Funktion kapselt den kompletten Ablauf: Parameter-Prüfung über assert_param(), Auslesen des aktuellen Zustands aus dem ODR-Register, Berechnung des inversen Werts und zwei Schreibzugriffe auf das BSRR-Register. Darüber hinaus entstehen Kosten durch den Funktionsaufruf selbst (Auslagern der Parameter, Sprung).

Gemessene Toggle-Frequenz: 200 kHz
Effektive CPU-Zyklen pro vollständigem Toggle-Zyklus: ≈40 (basierend auf Messung)

Das bedeutet: Für einen High‑Low‑High‑Zyklus werden rund 40 Taktzyklen verbraucht – etwa 20 Zyklen pro einzelnen TogglePin-Aufruf. Bei 8 MHz bleibt für weitere Aufgaben in der Schleife kein Spielraum, wenn die Frequenz von 200 kHz gehalten werden soll.

 
 
2. CMSIS ODR-XOR – Registerzugriff pur
while (1) {
    GPIOB->ODR ^= GPIO_ODR_ODR8;
}

Diese einzelne Zeile wird vom Compiler in eine Read-Modify-Write-Sequenz übersetzt: Laden des Registerinhalts (LDR), bitweises XOR (EOR) und Zurückschreiben (STR). Kein Funktionsaufruf, keine Typprüfung – nur drei Maschineninstruktionen.

Gemessene Toggle-Frequenz: 445 kHz
Effektive CPU-Zyklen pro vollständigem Toggle-Zyklus: ≈18

Die Ausführungszeit sinkt auf weniger als die Hälfte der HAL‑Variante. Allerdings ist das XOR auf das ODR nicht atomar: Unterbricht ein Interrupt die Sequenz und modifiziert ebenfalls das ODR, geht die Änderung durch den späteren Schreibbefehl verloren (Race Condition).

 
 
3. BSRR – Die schnellste und sicherste Alternative

while (1) {
    GPIOB->BSRR = GPIO_BSRR_BS8;   // Bit setzen
    GPIOB->BSRR = GPIO_BSRR_BR8;   // Bit rücksetzen
}

Das Bit Set/Reset Register (BSRR) erlaubt es, einen Pin ausschließlich schreibend zu setzen oder zurückzusetzen – ohne zuvor den aktuellen Zustand zu lesen. Die oberen 16 Bit (BRx) löschen den entsprechenden Pin, die unteren 16 (BSx) setzen ihn. Die Compiler-Ausgabe besteht aus nur zwei Store‑Instruktionen (STR). Die Operation ist inhärent atomar und damit interruptsicher.

Die reinen zwei Speicherzugriffe (Set → Reset) würden eine theoretische Toggle-Frequenz von 2,0 MHz ergeben (Periodendauer 500 ns). Durch den notwendigen Schleifen-Overhead – nach dem Rücksetzen muss der Prozessor zurück zum Schleifenanfang springen – reduziert sich die nutzbare Frequenz in der while(1)-Schleife auf 1,6 MHz.

Gemessene Toggle-Frequenz (Schleife): 1,6 MHz
Reine BSRR-Signalfrequenz (theoretisch): 2,0 MHz
Effektive CPU-Zyklen pro vollständigem Toggle-Zyklus: ≈5

Die Pause zwischen den schnellen Impulsen im Oszilloskopbild ist genau der Schleifen-Overhead; er dominiert bei dieser Implementierung die Periodendauer.

 
 
Der Perspektivwechsel: Nicht die Spitze, sondern die Reserve zählt

Die maximalen Toggle-Frequenzen sind beeindruckend, aber für die Praxis relevanter ist die Frage: Wie viel CPU‑Zeit bleibt bei einer gegebenen Ausgangsfrequenz für andere Aufgaben? Genau hier liegt der oft übersehene Vorteil von BSRR.

Nehmen wir eine typische Aufgabenstellung: Ein 200 kHz‑Rechtecksignal soll erzeugt werden. Mit der HAL-Funktion läuft der Mikrocontroller bereits an seiner Grenze – bei 200 kHz sind 100 % der Schleifenzeit mit dem Toggelvorgang belegt. Jeder zusätzliche Rechenbefehl würde die Frequenz sofort einbrechen lassen.

Mit ODR-XOR wird für den reinen Toggle nur ein Teil der Zyklen benötigt. Die restliche Zeit kann für Berechnungen genutzt werden. Und mit BSRR bleibt der Großteil der Zyklen frei.

Die folgende Tabelle quantifiziert diesen Effekt für eine Ziel‑Frequenz von 200 kHz (Halbperiode = 2,5 µs = 20 CPU‑Zyklen bei 8 MHz):

| Methode | Zyklen für Toggle pro Halbperiode | Freie Zyklen pro Halbperiode | CPU-Auslastung durch Toggle |
|---------|-----------------------------------|------------------------------|-----------------------------|
| HAL     | ≈20 (100 %)                       | 0                            | 100 %                       |
| ODR-XOR | ≈9                                | 11                           | 45 %                        |
| BSRR    | ≈2,5                              | 17,5                         | 12,5 %                      |


Die Zahl der freien Zyklen ist der Spielraum, der für Applikationslogik, Sensorabfragen oder komplexe Berechnungen zur Verfügung steht. BSRR vergrößert diesen Spielraum gegenüber HAL um fast das Achtfache.
Praktische Veranschaulichung: Variable Last zwischen den Flanken

Der Gewinn wird noch greifbarer, wenn wir zwischen den beiden BSRR-Zugriffen eine künstliche Arbeitslast einbauen:

static inline void do_some_work(volatile uint32_t n) {
    for (volatile uint32_t i = 0; i < n; ++i) {
        __NOP();   // eine CPU-No-Operation
    }
}

while (1) {
    GPIOB->BSRR = GPIO_BSRR_BS8;   // Pin high
    do_some_work(N);              // variable Last
    GPIOB->BSRR = GPIO_BSRR_BR8;   // Pin low
    do_some_work(N);              // variable Last
}

Für N = 0 erhalten wir die maximale Frequenz von 1,6 MHz. Mit steigendem N sinkt die Frequenz, aber selbst bei beachtlichen N-Werten bleibt eine hohe Ausgangsfrequenz erhalten. Bei N = 10 beträgt die zusätzliche Verzögerung pro Halbperiode nur wenige 100 ns – die resultierende Frequenz liegt immer noch im hohen Hundert‑kHz‑Bereich.

Mit HAL hingegen würde bereits N = 2 die 200 kHz‑Marke unterschreiten. Das Experiment zeigt eindrucksvoll: BSRR entkoppelt das Timing des Ausgangssignals weitgehend von der Rechenlast, weil der eigentliche Toggle fast keine Zyklen bindet.
Atomizität: Der stille Vorteil

Neben der reinen Geschwindigkeit bringt der BSRR-Zugriff einen entscheidenden Sicherheitsgewinn: Das Setzen und Rücksetzen erfolgt über unabhängige Speicherzugriffe. Es gibt keine Read-Modify-Write-Phase, die von Interrupts unterbrochen werden könnte. In Systemen, in denen mehrere Codepfade denselben GPIO-Port manipulieren (z. B. eine ISR und der Hauptcode), vermeidet BSRR subtile Race Conditions ohne den Zusatzaufwand von Critical Sections.
Einordnung und Entscheidungshilfe

Die gezeigten Unterschiede bedeuten nicht, dass HAL oder ODR‑XOR pauschal „falsch“ sind. Die Abstraktionsebene muss zum Anwendungsfall passen:

HAL ist die richtige Wahl, wenn:

    maximale Entwicklungsgeschwindigkeit gefragt ist,
    das Team heterogene Erfahrungsstufen hat,
    der GPIO-Toggle nicht im zeitkritischen Pfad liegt (LED-Blinken, Statusanzeigen),
    Portabilität zwischen verschiedenen STM32-Familien wichtig ist.

Direkter Registerzugriff (ODR/BSRR) ist zu bevorzugen, wenn:

    Echtzeitanforderungen bestehen (Bitbanging, Software-PWM >100 kHz),
    ein möglichst großer CPU-Freiraum für andere Aufgaben erhalten bleiben soll,
    das genaue zeitliche Verhalten nachvollziehbar sein muss (keine versteckten HAL‑Pfade),
    Interrupt-Sicherheit ohne zusätzliche Abschaltung gefordert ist.

In vielen Projekten ist ein hybrider Ansatz sinnvoll: Die Initialisierung und Konfiguration erfolgt über HAL (komfortabel und erprobt), während zeitkritische Schleifen auf BSRR umgestellt werden.
Fazit

Die Leistungsfähigkeit eines Mikrocontrollers bemisst sich nicht allein daran, wie schnell er einen Pin umschalten kann, sondern wie viel Rechenleistung nach der Toggle-Operation noch für die eigentliche Aufgabe übrig bleibt. Der vorliegende Vergleich zeigt, dass BSRR gegenüber HAL die CPU-Auslastung für einen 200‑kHz‑Pin um den Faktor 8 reduziert. Die gewonnene Zyklenzahl kann den Unterschied ausmachen zwischen „das System ist ausgelastet“ und „es gibt noch reichlich Reserven für komplexe Algorithmen“.

Die Beschäftigung mit den unterschiedlichen Abstraktionsebenen ist kein Selbstzweck – sie ermöglicht es, die Ressourcen eines STM32 optimal zu nutzen. Die Entscheidung für oder gegen eine Methode sollte stets auf Basis der konkreten Timing‑Anforderungen und des benötigten CPU‑Budgets getroffen werden.
Ausblick

Im folgenden Beitrag untersuchen wir den Einfluss der GPIO-Output-Speed-Einstellung (OSPEEDR) auf die Signalqualität – Flankensteilheit, Überschwingen und EMV-Verhalten. Dieser Parameter wird oft mit der Toggle-Frequenz verwechselt, hat aber unmittelbare Auswirkungen auf die Signalintegrität.
Video

{{< youtube VIDEO_ID >}}
<!-- Sobald das Video veröffentlicht ist, VIDEO_ID durch die YouTube-ID ersetzen. -->

Quellen & Quellcode