# Pedometer & Actigraphy Accumulation Semantics (July 5, 2026)
## Continuous Accumulation
Activity monitoring tracks 3-axis acceleration vectors:
- Magnitude vector: $A = \sqrt{x^2 + y^2 + z^2} - 1g$.
- Peak detection: Adaptive thresholding for step cadence.
- Slicing: Real-time accumulation across calendar dates with midnight boundary resets.
