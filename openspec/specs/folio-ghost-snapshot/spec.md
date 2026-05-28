# folio-ghost-snapshot Specification

## Purpose

Defines the Ghost Snapshot animation technique used for page turns in
the folio reader: clone the current viewport as a fixed overlay,
instantly jump the real content, animate the ghost out via the Web
Animations API, and remove it on completion. Also owns the three
configurable turn styles (`rotate` / `slide` / `fade`), the WAAPI-only
rule, and the lock that prevents overlapping turns.

## Requirements

### Requirement: Ghost Snapshot page turn mechanism

Page turns in page mode SHALL use the Ghost Snapshot technique: (1) clone the current viewport as a fixed-position overlay, (2) instantly jump the real content to the new page (no transition), (3) animate the ghost clone out using Web Animations API, (4) remove the ghost from the DOM on animation completion.

#### Scenario: Forward page turn
- **WHEN** the user navigates to the next page
- **THEN** a ghost clone of the current viewport appears as a fixed overlay, the real content jumps to the next page, and the ghost animates out over 320ms

#### Scenario: Backward page turn
- **WHEN** the user navigates to the previous page
- **THEN** the ghost animation plays in the reverse direction (e.g., `rotateY` toward positive degrees for `rotate` style)

#### Scenario: Ghost cleanup
- **WHEN** the ghost animation completes (via `animation.finished` promise)
- **THEN** the ghost element is removed from the DOM immediately

### Requirement: Configurable turn styles

The system SHALL support three turn styles configured via `state.turnStyle`:

- `'rotate'`: `rotateY(0 → ±90deg)` with `opacity(1 → 0)`, transform origin at the trailing edge. Default style.
- `'slide'`: `translateX(0 → ±100%)` — the ghost slides off-screen.
- `'fade'`: `opacity(1 → 0)` with `scale(1 → 0.97)` — minimal, suitable for plain text.

#### Scenario: Rotate style animation
- **WHEN** `turnStyle` is `'rotate'` and the user turns to the next page
- **THEN** the ghost animates with `rotateY(0 → -90deg)`, `opacity(1 → 0)`, transform origin `'right center'`, duration 320ms, easing `ease-in`

#### Scenario: Slide style animation
- **WHEN** `turnStyle` is `'slide'` and the user turns to the next page
- **THEN** the ghost animates with `translateX(0 → -100%)`, duration 320ms

#### Scenario: Fade style animation
- **WHEN** `turnStyle` is `'fade'` and the user turns to the next page
- **THEN** the ghost animates with `opacity(1 → 0)` and `scale(1 → 0.97)`, duration 320ms

### Requirement: Animation uses Web Animations API only

Ghost animations SHALL use the Web Animations API (`element.animate()` + `animation.finished`) exclusively. No animation library (framer-motion, GSAP, etc.) SHALL be used.

#### Scenario: WAAPI usage
- **WHEN** a ghost animation is triggered
- **THEN** it is created via `ghost.animate(keyframes, options)` and cleanup awaits the `finished` promise

### Requirement: Animation lock during turn

While a ghost animation is in-flight, additional page turn requests SHALL be ignored to prevent overlapping animations.

#### Scenario: Rapid page turns
- **WHEN** the user swipes next while a ghost animation is still playing
- **THEN** the second turn request is discarded until the current animation completes
