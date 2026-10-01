# OKOK C0 broadcast protocol

Status: experimentally supported for weight; body-composition signal remains unverified.

## Captured stable frame

```text
C0 5B 26 39 17 70 0A 01 25 F8 8F C8 35 68 5B
```

On Apple platforms the first two bytes are the little-endian manufacturer identifier. Its low byte is always `C0`; the high byte increments while the scale is active and stops when the result locks.

The remaining 13-byte payload is currently interpreted as:

| Offset | Example | Interpretation |
| --- | --- | --- |
| 0-1 | `26 39` | Weight, big endian. Attribute selects `/100`, yielding 97.85 kg. |
| 2-3 | `17 70` | Proprietary body/electrode signal. Not validated as impedance. |
| 4-5 | `0A 01` | Product/protocol constants. |
| 6 | `25` | Stable flag, unit and decimal resolution. `24` is an in-progress frame. |
| 7-12 | `F8 8F C8 35 68 5B` | Device MAC embedded in the payload. |

## Why `0x1770` is not exposed as 600 ohms

Independent public captures report the exact same `17 70` bytes at 81.50, 81.75, 82.25 and 82.95 kg. The local capture reports the same bytes at 97.85 kg. A physiological impedance measurement should vary across people, contact conditions and sessions; a bit-identical value across these captures is more consistent with a sentinel, completion marker or fixed placeholder.

MyHealthData therefore preserves the raw code for diagnostics but does not label or store it as impedance. Body-composition estimates must remain clearly separate from directly transmitted measurements.

## Validation experiment

Collect stable frames from multiple sessions under controlled conditions:

1. Bare feet, normal contact.
2. Socks or insulating sheet, so electrode contact is impossible.
3. A second person with a substantially different build.
4. The same person on different days and hydration conditions.

Only a varying field that responds plausibly to electrode contact should be considered an impedance candidate.

## Public references

- openScale issue 950 and PR 1088 document the nameless 13-byte OKOK format.
- dimwap/scale-okok publishes multiple independent raw captures and concludes that this variant transmits only weight.
- OKOK documents BIA-derived composition values as estimates rather than direct tissue measurements.
