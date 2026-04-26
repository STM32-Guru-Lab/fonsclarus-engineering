+++
title = 'STM32 Bare-Metal GPIO: A Register-Level Guide'
date = 2026-04-20
description = 'A deep dive into configuring and controlling GPIO pins on STM32 microcontrollers without HAL or CMSIS abstractions.'
tags = ['stm32', 'embedded', 'gpio', 'bare-metal', 'c']
+++

Modern embedded development often relies on Hardware Abstraction Layers (HAL) and CMSIS libraries. While these are useful for rapid prototyping, understanding the register-level details is essential for debugging, performance optimization, and working with resource-constrained systems.

## Memory-Mapped Peripherals

STM32 microcontrollers use a memory-mapped architecture. Each peripheral occupies a specific region of the address space:

| Peripheral | Base Address |
|-----------|-------------|
| GPIOA     | `0x40020000` |
| GPIOB     | `0x40020400` |
| GPIOC     | `0x40020800` |
| RCC       | `0x40023800` |

{{< highlight c >}}
#define GPIOA_BASE 0x40020000UL
#define RCC_BASE   0x40023800UL

// Register offsets
#define GPIOx_MODER   (volatile uint32_t *)(GPIOA_BASE + 0x00)
#define GPIOx_ODR     (volatile uint32_t *)(GPIOA_BASE + 0x14)
#define GPIOx_BSRR    (volatile uint32_t *)(GPIOA_BASE + 0x18)
#define RCC_AHB1ENR   (volatile uint32_t *)(RCC_BASE + 0x30)
{{< /highlight >}}

## Enabling the GPIO Clock

Before accessing any GPIO registers, the peripheral clock must be enabled through the Reset and Clock Control (RCC) unit:

{{< highlight c >}}
// Enable GPIOA clock (bit 0 in AHB1ENR)
*RCC_AHB1ENR |= (1 << 0);

// Read-modify-write to preserve other clock settings
uint32_t tmp = *RCC_AHB1ENR;
tmp |= (1UL << 0);
*RCC_AHB1ENR = tmp;
{{< /highlight >}}

## Configuring Pin Mode

Each GPIO pin has a 2-bit field in the MODER register:

- `00`: Input (reset state)
- `01`: General purpose output
- `10`: Alternate function
- `11`: Analog

{{< highlight c >}}
// Set PA5 to output mode (MODER[11:10] = 01)
uint32_t moder = *GPIOA_MODER;
moder &= ~(3UL << 10);  // Clear bits 10-11
moder |=  (1UL << 10);  // Set bit 10
*GPIOA_MODER = moder;
{{< /highlight >}}

## Writing Output Data

The Output Data Register (ODR) controls the output state:

{{< highlight c >}}
// Set PA5 high
*GPIOA_ODR |= (1UL << 5);

// Set PA5 low
*GPIOA_ODR &= ~(1UL << 5);

// Toggle PA5
*GPIOA_ODR ^= (1UL << 5);
{{< /highlight >}}

The Bit Set/Reset Register (BSRR) provides atomic operations:

{{< highlight c >}}
// Atomic set PA5 (lower 16 bits = set bits)
*GPIOA_BSRR = (1UL << 5);

// Atomic reset PA5 (upper 16 bits = reset bits)
*GPIOA_BSRR = (1UL << (5 + 16));
{{< /highlight >}}

## Complete Example: Blinking LED

{{< highlight c >}}
#include <stdint.h>

#define GPIOA_BASE  0x40020000UL
#define RCC_BASE    0x40023800UL

#define RCC_AHB1ENR (*(volatile uint32_t *)(RCC_BASE + 0x30))
#define GPIOA_MODER (*(volatile uint32_t *)(GPIOA_BASE + 0x00))
#define GPIOA_BSRR  (*(volatile uint32_t *)(GPIOA_BASE + 0x18))

static void delay(volatile uint32_t count) {
    while (count--) {
        __asm__("nop");
    }
}

int main(void) {
    // Enable GPIOA clock
    RCC_AHB1ENR |= (1UL << 0);

    // PA5 as output
    GPIOA_MODER &= ~(3UL << 10);
    GPIOA_MODER |=  (1UL << 10);

    while (1) {
        GPIOA_BSRR = (1UL << 5);       // LED on
        delay(500000);

        GPIOA_BSRR = (1UL << (5 + 16)); // LED off
        delay(500000);
    }
}
{{< /highlight >}}

## Key Takeaways

1. **Always enable the peripheral clock first** — reading unclocked registers can cause hard faults.
2. **Use BSRR for atomic bit operations** — avoids race conditions in interrupt-driven code.
3. **Read-modify-write is not atomic** — use BSRR or careful interrupt masking when needed.
4. **The reference manual is your best friend** — each STM32 series has different register layouts and bit positions.
