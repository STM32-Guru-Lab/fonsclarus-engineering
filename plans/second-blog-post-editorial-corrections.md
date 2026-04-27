# Post 2 — Editorial Corrections

## Änderungsübersicht

Basierend auf dem detaillierten Feedback sind **6 Änderungen** an [`content/blog/stm32-gpio-cpu-headroom/index.md`](../content/blog/stm32-gpio-cpu-headroom/index.md) vorzunehmen.

---

### 1. "BSRR entkoppelt Timing" → präzisieren (Zeile 95)

**Aktuell:**
> BSRR entkoppelt das Timing des Ausgangssignals weitgehend von der Rechenlast

**Problem:** Software-Timing in `while(1)`-Schleife kann nicht entkoppeln — jede zusätzliche Operation beeinflusst die Frequenz. Echte Entkopplung erfordert Timer/PWM/DMA/Interrupts.

**Ziel:**
> BSRR reduziert die Fixkosten des Pin-Umschaltens deutlich. Dadurch bleibt bei gleicher Ziel-Frequenz mehr CPU-Zeit für weitere Operationen.

---

### 2. "Sensorabfragen oder komplexe Berechnungen" → realistischer (Zeile 51)

**Aktuell:**
> für Applikationslogik, Sensorabfragen oder komplexe Berechnungen

**Problem:** Bei 200 kHz stehen nur ~17,5 Zyklen/Halbperiode zur Verfügung. Das reicht nicht für Sensorabfragen, wohl aber für kleine Operationen.

**Ziel:**
> für einfache Zustandslogik, Bitmanipulationen oder kleine zeitkritische Operationen

---

### 3. NOP-Demo `for(volatile ...)` → Loop-Overhead klarstellen (Zeile 93)

**Aktuell:**
> Bei N = 10 beträgt die zusätzliche Verzögerung pro Halbperiode nur wenige 100 ns

**Problem:** Die `for(volatile ...)`-Schleife erzeugt nicht nur N NOPs, sondern auch Overhead (Zählvariable laden/speichern, Vergleich, Branch, volatile-Zugriffe). Die Behauptung "wenige 100 ns" ist irreführend.

**Ziel:**
> N ist hier kein direkter Zykluswert — die Schleife erzeugt neben den N NOPs auch Overhead durch das Laden und Speichern der Zählvariablen, den Vergleich und den bedingten Sprung. Die tatsächliche Verzögerung muss gemessen werden, da Compiler-Optimierung und Schleifen-Overhead die Laufzeit bestimmen.

Zusätzlich **unrolled NOPs als Alternative** zeigen:
```c
while (1) {
    GPIOB->BSRR = GPIO_BSRR_BS8;
    __NOP(); __NOP(); __NOP(); // exakt 3 Zyklen
    GPIOB->BSRR = GPIO_BSRR_BR8;
    __NOP(); __NOP(); __NOP(); // exakt 3 Zyklen
}
```

---

### 4. BSRR 2,5 Zyklen → Asymmetrie erwähnen (nach Zeile 49 / bei Zeile 69)

**Aktuell:** 2,5 Zyklen/Halbperiode wird als symmetrischer Wert präsentiert.

**Problem:** Das Signal ist asymmetrisch — Set→Reset ist sehr kurz, Reset→nächster Set enthält den Schleifenrücksprung. Der Wert 2,5 ist ein mathematischer Mittelwert.

**Ziel:** Nach der Herleitung oder in der Tabelle einen Hinweis einfügen:
> Im Mittel entspricht das etwa 2,5 Zyklen pro Halbperiode. Tatsächlich ist das Signal asymmetrisch: Die Set→Reset-Flanke ist kürzer als die Pause bis zum nächsten Schleifendurchlauf.

---

### 5. "Faktor 8" → präzisieren (Zeile 116)

**Aktuell:**
> BSRR gegenüber HAL die CPU-Auslastung für einen 200-kHz-Pin um den Faktor 8 reduziert

**Problem:** Könnte so interpretiert werden, dass "die ganze Applikation 8× schneller läuft". Tatsächlich bezieht sich der Faktor nur auf den **reinen GPIO-Umschaltanteil**.

**Ziel:**
> BSRR reduziert den CPU-Anteil für die reine GPIO-Umschaltung bei einer 200-kHz-Zielfrequenz gegenüber HAL um etwa Faktor 8.

---

### 6. Warnhinweis einbauen (nach Zeile 12 oder Zeile 25)

**Aktuell:** Kein Hinweis auf die Einschränkung der Methode.

**Problem:** Leser könnten glauben, softwaregetoggeltes Signal bei 200 kHz sei eine valide Methode zur Signalerzeugung in der Praxis.

**Ziel:** Warnbox einfügen — z. B. nach dem Testaufbau oder in der Einleitung:
> ⚠️ **Hinweis:** Diese Betrachtung gilt für softwaregetriebenes GPIO-Toggling in einer `while(1)`-Schleife. Für präzise Signalerzeugung sind Timer, PWM oder DMA die bessere Lösung. Der Benchmark zeigt nicht, wie man ein perfektes 200-kHz-Signal erzeugt, sondern wie viel CPU-Budget unterschiedliche Implementierungen im reinen Toggle-Vorgang verbrauchen.

---

## Bearbeitungsreihenfolge

1. Warnhinweis einfügen (6) — frühe Position im Text
2. "Sensorabfragen" ersetzen (2) — Zeile 51
3. Asymmetrie-Hinweis einfügen (4) — nach der Herleitung, Zeile ~72
4. NOP-Demo korrigieren (3) — Zeile 93
5. "BSRR entkoppelt" ersetzen (1) — Zeile 95
6. "Faktor 8" präzisieren (5) — Zeile 116
