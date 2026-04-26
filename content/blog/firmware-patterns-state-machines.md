+++
title = 'State Machine Patterns for Embedded Firmware'
date = 2026-04-15
description = 'Comparing enum-based, function-pointer, and table-driven state machine implementations in C for resource-constrained systems.'
tags = ['embedded', 'firmware', 'patterns', 'c', 'state-machines']
+++

State machines are one of the most important patterns in embedded firmware. They provide predictable, testable, and maintainable control flow for everything from button debouncing to protocol handling.

## Why State Machines?

Embedded systems are inherently event-driven. A state machine models this naturally:

- **Deterministic behavior** — given a state and event, the next state is always known
- **Testability** — each state-event combination can be tested independently
- **Readability** — the entire system behavior is visible in one structure
- **Resource efficiency** — no dynamic allocation, minimal RAM usage

## Pattern 1: Enum + Switch

The simplest approach uses an enum and a switch statement:

{{< highlight c >}}
typedef enum {
    STATE_IDLE,
    STATE_ACTIVE,
    STATE_ERROR,
    STATE_COUNT
} state_t;

static state_t current_state = STATE_IDLE;

void sm_process(event_t event) {
    switch (current_state) {
        case STATE_IDLE:
            if (event == EVENT_START) {
                current_state = STATE_ACTIVE;
            }
            break;

        case STATE_ACTIVE:
            if (event == EVENT_ERROR) {
                current_state = STATE_ERROR;
            } else if (event == EVENT_STOP) {
                current_state = STATE_IDLE;
            }
            break;

        case STATE_ERROR:
            if (event == EVENT_RESET) {
                current_state = STATE_IDLE;
            }
            break;

        default:
            break;
    }
}
{{< /highlight >}}

**Pros**: Simple, readable, easy to debug.  
**Cons**: Becomes unwieldy with many states; action logic mixed with transition logic.

## Pattern 2: Function Pointer Table

Each state is a function. State transitions happen by changing the active function pointer:

{{< highlight c >}}
typedef void (*state_fn_t)(event_t);

static void state_idle(event_t e);
static void state_active(event_t e);
static void state_error(event_t e);

static state_fn_t current_state = state_idle;

static void state_idle(event_t e) {
    if (e == EVENT_START) {
        current_state = state_active;
    }
}

static void state_active(event_t e) {
    if (e == EVENT_ERROR) {
        current_state = state_error;
    } else if (e == EVENT_STOP) {
        current_state = state_idle;
    }
}

static void state_error(event_t e) {
    if (e == EVENT_RESET) {
        current_state = state_idle;
    }
}

void sm_process(event_t e) {
    current_state(e);
}
{{< /highlight >}}

**Pros**: Clean separation, easy to add states, good for complex behavior.  
**Cons**: Transitions are hidden inside functions; harder to audit the entire state machine at a glance.

## Pattern 3: Table-Driven State Machine

The gold standard for production firmware. A transition table defines all behavior declaratively:

{{< highlight c >}}
typedef struct {
    state_t     current_state;
    event_t     event;
    state_t     next_state;
    action_fn_t action;
} transition_t;

static const transition_t sm_table[] = {
    { STATE_IDLE,   EVENT_START,  STATE_ACTIVE, action_start_device },
    { STATE_ACTIVE, EVENT_STOP,   STATE_IDLE,   action_stop_device  },
    { STATE_ACTIVE, EVENT_ERROR,  STATE_ERROR,  action_handle_error },
    { STATE_ERROR,  EVENT_RESET,  STATE_IDLE,   action_reset_device },
    { STATE_IDLE,   EVENT_UNUSED, STATE_IDLE,   NULL },
};

void sm_process(event_t event) {
    for (size_t i = 0; sm_table[i].event != EVENT_UNUSED; i++) {
        if (sm_table[i].current_state == current_state &&
            sm_table[i].event == event) {

            if (sm_table[i].action) {
                sm_table[i].action();
            }

            current_state = sm_table[i].next_state;
            return;
        }
    }
}
{{< /highlight >}}

**Pros**: Fully declarative, easy to validate, simple to add/remove transitions.  
**Cons**: Slightly more code overhead; table must be kept in sorted order for large state machines.

## Choosing the Right Pattern

| Pattern | State Count | Complexity | Best For |
|---------|------------|------------|----------|
| Enum+Switch | < 10 | Low | Button debouncing, simple protocols |
| Function Pointer | 5-20 | Medium | Protocol handlers, device drivers |
| Table-Driven | Any | Medium-High | Complex systems, safety-critical code |

For most embedded firmware, I recommend starting with the table-driven approach. It's slightly more code up front, but pays dividends during debugging and maintenance.
