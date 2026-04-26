+++
title = 'STM32 Custom Bootloader'
date = 2026-04-10
description = 'A minimal custom bootloader for STM32F4 microcontrollers with UART firmware update capability.'
tags = ['stm32', 'bootloader', 'embedded', 'c']
+++

A lightweight custom bootloader for STM32F4xx microcontrollers that supports firmware updates over UART. Designed for production use where OTA updates or field firmware upgrades are required.

## Features

- UART-based firmware upload with XMODEM protocol
- CRC32 integrity verification
- Configurable flash layout
- Watchdog timer support
- Minimal footprint (~4KB)
