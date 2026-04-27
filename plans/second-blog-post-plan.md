# Plan: Zweiter Blog-Post — CPU-Reserve mit BSRR

## Ziel

Aus dem Entwurf in [`content/drafts/_index.md`](content/drafts/_index.md) einen vollständigen, veröffentlichungsfähigen Blog-Post erstellen, der auf [`content/blog/stm32-hal-vs-cmsis-gpio-toggle/index.md`](content/blog/stm32-hal-vs-cmsis-gpio-toggle/index.md) aufbaut.

## Probleme im aktuellen Entwurf

### 1. Formatierung
| Problem | Ort | Lösung |
|---------|-----|--------|
| Inhalt liegt in `content/drafts/_index.md` (Section-File) | gesamte Datei | Neues Verzeichnis `content/blog/stm32-gpio-cpu-headroom/` mit eigener `index.md` |
| TOML-Frontmatter zwischen `+++`-Delimitern mitten im Markdown | Zeilen 10-15 | Als echten Hugo-Frontmatter an den Anfang der Datei setzen |
| Fehlende `##`-Überschriften bei Sektionen | "Der Perspektivwechsel", "Praktische Veranschaulichung", "Atomizität", "Einordnung", "Fazit", "Ausblick" | `##` vor jede Sektionsüberschrift |
| Fehlende Code-Fences beim ODR-XOR Beispiel | Zeilen 58-61 | Code in ```c ... ``` setzen |

### 2. Inhaltliche Lücken

| Lücke | Beschreibung |
|-------|-------------|
| **Verweis auf Post 1 fehlt** | Der Entwurf steht zu isoliert. Einleitung muss explizit Post 1 referenzieren: "Im ersten Beitrag haben wir die rohen Toggle-Frequenzen gemessen..." |
| **Ausblick doppelt / widersprüchlich** | Post 1 sagt: "Im folgenden Beitrag wird OSPEEDR untersucht." Der Entwurf sagt: "Im folgenden Beitrag untersuchen wir OSPEEDR." Da der Entwurf **der** folgende Beitrag ist, muss entweder Post 1's Ausblick aktualisiert werden (zeigt auf diesen Post) oder der Entwurf's Ausblick anders formulieren ("In einem weiteren Beitrag..."). **Empfehlung:** Post 1's Ausblick anpassen, dass dieser Post dazwischen kam. |
| **Bilddateien** | Post 1 verwendet `HAL_Toggle.jpg`, `CMSIS_ODR.jpg`, `CMSIS_BSSR.jpg`. Dieser Post sollte ggf. eigene Oszilloskop-Bilder haben (z. B. `BSRR_variable_load.jpg` für das `do_some_work()`-Experiment). |
| **English version?** | Wie Post 1 müsste ggf. eine Übersetzung unter `content/en/blog/` erstellt werden (kann später erfolgen). |

## Vorgeschlagene Struktur des finalen Posts

```
content/blog/stm32-gpio-cpu-headroom/
└── index.md
```

### Gliederung

```markdown
+++
title = 'STM32 GPIO unter der Lupe: Warum BSRR mehr CPU-Zeit für Ihre Anwendung bedeutet'
date = 2026-05-05
description = 'Der Performance-Vergleich zwischen HAL, CMSIS-ODR und BSRR geht über die reine Toggle-Frequenz hinaus: Wie viel CPU-Zeit bleibt nach dem Pin-Toggle für echte Aufgaben übrig?'
tags = ['stm32', 'gpio', 'hal', 'cmsis', 'bsrr', 'performance', 'embedded', 'cpu-utilization']
+++
```

1. **Einleitung** (Absatz 1-2)
   - Kurze Zusammenfassung von Post 1 (200 kHz / 445 kHz / 1,6 MHz)
   - Neue Fragestellung: "Wie viel CPU-Zeit bleibt bei einer gegebenen Ausgangsfrequenz für andere Aufgaben?"
   - => CPU-Reserve / CPU-Auslastung als Metrik

2. **Testaufbau** (übernommen aus Entwurf, leicht gekürzt, mit Verweis auf Post 1)
   - Nucleo-F103RB + Bluepill, 8 MHz HSI, `-O2`

3. **Der Perspektivwechsel: Nicht die Spitze, sondern die Reserve zählt**
   - Annahme: 200 kHz Ziel-Frequenz
   - Tabelle: Zyklen für Toggle / Freie Zyklen / CPU-Auslastung
   - HAL: 100% Auslastung, ODR-XOR: 45%, BSRR: 12,5%

4. **Praktische Veranschaulichung: Variable Last zwischen den Flanken**
   - `do_some_work()`-Funktion
   - N=0 => 1,6 MHz; mit steigendem N sinkt Frequenz
   - HAL würde bereits bei N=2 unter 200 kHz fallen

5. **Atomizität: Der stille Vorteil**
   - BSRR ist inhärent atomar (kein RMW)
   - Vergleich mit ODR-XOR (Race Condition bei Interrupts)
   - Praxisbeispiel: Hauptschleife + ISR greifen auf gleichen Port zu

6. **Einordnung und Entscheidungshilfe**
   - HAL: Wann sinnvoll
   - Direkter Registerzugriff: Wann sinnvoll
   - Hybrider Ansatz (HAL Init + BSRR Loop)

7. **Fazit**
   - BSRR reduziert CPU-Auslastung bei 200 kHz um Faktor 8 gegenüber HAL
   - Die gewonnene Zyklenzahl ist der entscheidende Vorteil für komplexe Anwendungen

8. **Ausblick**
   - Verweis auf nächsten Beitrag (OSPEEDR / Signalqualität)

9. **Video** (Platzhalter)

10. **Quellen & Quellcode**
    - Verweis auf GitHub (gleiches Repo wie Post 1)

## Zusätzlich: Post 1 Ausblick anpassen

In [`content/blog/stm32-hal-vs-cmsis-gpio-toggle/index.md`](content/blog/stm32-hal-vs-cmsis-gpio-toggle/index.md) Zeile 150-152 muss der Ausblick aktualisiert werden, sodass er auf diesen neuen Post verweist statt direkt auf OSPEEDR:

> Aktuell: "Im folgenden Beitrag wird untersucht, welchen Einfluss die GPIO-Output-Speed-Einstellung (OSPEEDR)..."
> Neu: "Im folgenden Beitrag wird untersucht, wie viel CPU-Zeit nach dem Pin-Toggle für echte Aufgaben übrig bleibt – und warum BSRR hier den entscheidenden Vorteil bietet."

Oder den Ausblick in Post 1 anpassen um auf diesen Post zu verlinken.

## Konkrete Arbeitsschritte

1. Neues Verzeichnis anlegen: `content/blog/stm32-gpio-cpu-headroom/`
2. `index.md` mit Hugo-Frontmatter + formatiertem Markdown aus dem Entwurf erstellen
3. Ausblick in Post 1 aktualisieren (referenziert diesen neuen Post)
4. Build testen (`hugo`)
5. Commit + Push
