---
title: "Artikel-Ideen & Entwürfe"
draft: true
build:
  list: never
  render: never
---

# Ideen

- [ ] STM32 I2C komplette Kommunikation von A bis Z
- [ ] Vergleich FreeRTOS vs. Zephyr OS
- [ ] Eigener Bootloader – warum und wie?

# Notizen

STM32 HAL vs CMSIS – echter Performance Vergleich

Einleitung

In diesem Beitrag schauen wir uns einen einfachen, aber sehr aufschlussreichen Vergleich an:
Wie schnell ist ein GPIO Toggle mit HAL im Vergleich zu direktem Registerzugriff über CMSIS?

Ziel ist es nicht, HAL schlecht darzustellen, sondern ein besseres Verständnis dafür zu bekommen, was im Hintergrund passiert und wann sich ein Wechsel auf Low-Level-Zugriffe lohnt.

Der Vergleich basiert auf realen Messungen mit einem Oszilloskop.

Testaufbau

Für den Test wurden zwei typische Boards verwendet:

Nucleo Board mit STM32F103RB
Bluepill mit STM32F103

Beide Systeme laufen mit einer Systemclock von 72 MHz.

Wichtig ist, dass alle Tests unter identischen Bedingungen durchgeführt wurden. Nur so ist ein fairer Vergleich möglich.

Der verwendete Test ist bewusst minimal gehalten:

Ein GPIO-Pin wird in einer Endlosschleife getoggelt
Das resultierende Signal wird mit einem Oszilloskop gemessen
Die Frequenz des Signals dient als direkte Aussage über die Ausführungsgeschwindigkeit

Messmethode

Das GPIO-Signal wird direkt am Pin mit einem Oszilloskop gemessen.
Zur Vermeidung von Messfehlern wurde eine kurze Masseverbindung mit Massefeder verwendet.

Das Ergebnis ist ein Rechtecksignal, aus dessen Periodendauer sich die effektive Toggle-Frequenz bestimmen lässt.

Wichtig: Es wird nicht geschätzt, sondern direkt gemessen.

HAL Implementierung

Die HAL-Version verwendet die bekannte Funktion:

HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);

Der Vorteil dieser Methode liegt in der einfachen Anwendung und der guten Lesbarkeit.

Allerdings entsteht durch die Verwendung der HAL ein gewisser Overhead:

Funktionsaufrufe
Parameterprüfungen
zusätzliche Abstraktionsschichten

Diese zusätzlichen Schritte wirken sich direkt auf die Ausführungsgeschwindigkeit aus.

CMSIS Implementierung (ODR)

Beim direkten Registerzugriff wird das Output Data Register verwendet:

GPIOA->ODR ^= GPIO_ODR_ODR5;

Hier wird der Zustand des Pins direkt über das Register verändert, ohne zusätzliche Funktionsaufrufe.

Das reduziert den Overhead deutlich und führt zu einer höheren Ausführungsgeschwindigkeit.

Allerdings handelt es sich hierbei um eine sogenannte Read-Modify-Write Operation, auf die später noch eingegangen wird.

BSRR Implementierung

Die schnellste und sauberste Methode nutzt das BSRR-Register:

GPIOA->BSRR = GPIO_BSRR_BS5;
GPIOA->BSRR = GPIO_BSRR_BR5;

Das BSRR-Register erlaubt das Setzen und Zurücksetzen von Bits ohne vorheriges Lesen des Registers.

Dadurch wird eine atomare Operation ermöglicht und zusätzlicher Overhead vermieden.

Diese Methode ist nicht nur schneller, sondern auch robuster gegenüber konkurrierenden Zugriffen.

Ergebnisse

Die Messung zeigt klare Unterschiede:

HAL erzeugt die niedrigste Toggle-Frequenz
CMSIS mit ODR ist deutlich schneller
BSRR liefert die höchste Geschwindigkeit

Die Unterschiede sind deutlich im Oszilloskop sichtbar und lassen sich direkt aus der Periodendauer ableiten.

Einordnung

Die Ergebnisse bedeuten nicht, dass HAL grundsätzlich ungeeignet ist.

HAL ist sinnvoll für:

schnelle Entwicklung
bessere Lesbarkeit
größere Projekte mit höherer Abstraktion

Direkter Registerzugriff ist sinnvoll, wenn:

Timing kritisch ist
maximale Performance benötigt wird
das Verhalten exakt kontrolliert werden muss

Die Wahl des richtigen Werkzeugs hängt also stark vom Anwendungsfall ab.

Fazit

Der Vergleich zeigt deutlich, wie sich unterschiedliche Abstraktionsebenen auf die Performance auswirken.

HAL bietet Komfort und Geschwindigkeit in der Entwicklung, während CMSIS und direkter Registerzugriff maximale Kontrolle und Performance ermöglichen.

Wer STM32-Systeme wirklich verstehen möchte, sollte sich mit beiden Ansätzen beschäftigen und bewusst entscheiden, welcher Ansatz in welcher Situation sinnvoll ist.

Ausblick

Im nächsten Beitrag wird gezeigt, welchen Einfluss die GPIO Output Speed Einstellung auf das elektrische Verhalten des Signals hat und warum diese oft falsch interpretiert wird.

# In Arbeit

-
