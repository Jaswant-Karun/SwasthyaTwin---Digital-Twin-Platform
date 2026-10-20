# SwasthyaTwin — 3-Minute Live Demonstration Script

**Target Duration:** 3 minutes (180 seconds)  
**Presenter:** Full-Stack & Clinical AI Engineering Team  
**Live Application URL:** `http://localhost:5173/`  
**Swagger Docs URL:** `http://localhost:8000/docs`  

---

### Segment 1: Introduction & Real-time Connectivity (0:00 – 0:35)

- **Action:** Open browser at `http://localhost:5173/`. Point cursor to the top header.
- **Spoken Script:**
  > *"Welcome everyone. This is **SwasthyaTwin** — a personalized healthcare digital twin platform designed for early biological drift detection and preventive lifestyle intervention.
  >
  > Notice right away in the top bar: our connection indicator is not a hardcoded green dot. It performs an active live probe against our local MongoDB database, showing a real-time round-trip latency of 0.8 milliseconds. 
  >
  > We are currently looking at Aarav Mehta, a 38-year-old professional. Unlike traditional fitness apps that compare Aarav's resting heart rate to arbitrary population averages, SwasthyaTwin builds an **individual baseline corridor** from his own past 30 days of continuous telemetry."*

---

### Segment 2: Baseline Corridor & Explainable Vitality Score (0:35 – 1:15)

- **Action:** Scroll down slightly to highlight the 5 biometric cards (Resting HR, Blood Pressure, Respiratory Rate, Sleep, Daily Steps) and the shaded $\mu \pm 1.5\sigma$ band on the main chart.
- **Spoken Script:**
  > *"Look at the longitudinal chart. That shaded teal band represents Aarav's personal 1.5-sigma biological tolerance envelope. When observations stay inside that band, his vitality is preserved.
  >
  > But over the past two weeks, look at his resting heart rate: it has spiked to 76 bpm, which is +18.4% above his personal baseline of 64.2 bpm, with a Z-score of +3.81 sigma. 
  >
  > Next, look at our **Vitality Index** score of 68/100. Rather than using an opaque black-box ML score that doctors can't trust, every single point deducted is 100% mathematically transparent. In the Transparent Vitality Deductions panel, you see exactly why points were deducted: -16 points for sustained sleep deficit and -16 points for autonomic cardiovascular drift."*

---

### Segment 3: Fast Patient Switching & Alert Center (1:15 – 1:55)

- **Action:** In the TopNav patient dropdown, switch from **Aarav Mehta (`PT-1001`)** to **Priya Sharma (`PT-1002`)**. Then click on the **Alert Center** in the sidebar.
- **Spoken Script:**
  > *"Let's switch patients to Priya Sharma, a 54-year-old recovering from hypertension. Notice how seamlessly the entire application updates without any page reload. Notice also our race-condition protection: even if we switch patients rapidly, outdated asynchronous packets are safely discarded.
  >
  > Now let's navigate to the **Alert Center**. Here we see explainable deviation alerts triggered strictly when biometrics breach individual thresholds. 
  >
  > Let's click **'Acknowledge Alert'** on her physical activity drift. Watch the status change immediately to 'Reviewed', and notice that this persists directly to our MongoDB backend via our REST API. If we refresh the page, the acknowledgement is permanently saved."*

---

### Segment 4: Counterfactual What-If Intervention Simulator (1:55 – 2:35)

- **Action:** Click **What-if Simulator** in the sidebar. Move the **Sleep Extension** slider to `+1.5 hrs/night`, add `+3,000 steps`, and click **'Run Simulation'**.
- **Spoken Script:**
  > *"Now for our flagship predictive capability: the **What-If Counterfactual Simulator**.
  >
  > What if Priya were to extend her nightly sleep by 1.5 hours and increase her daily walking by 3,000 steps? We adjust the sliders and click **'Run Simulation'**.
  >
  > Within milliseconds, our backend simulation engine models her physiological adaptation trajectory over a 30-day horizon using verified exponential saturation kinetics. 
  >
  > Notice the crucial safety design here: every single simulated point and metric card is prominently flagged with an amber **'Simulated Output'** badge, and the exact scientific model assumptions and disclaimers are dynamically rendered right below the graph so simulated curves can never be mistaken for clinical observations."*

---

### Segment 5: Real-Time Telemetry Ingest & Wrap-up (2:35 – 3:00)

- **Action:** Click **Patient Timeline** in the sidebar. Click **'Log Measurement'**, input `Heart Rate = 72 bpm`, and click **'Commit to Digital Twin'**.
- **Spoken Script:**
  > *"Finally, let's test reactivity. On the Patient Timeline, let's manually log a new biometric observation of 72 bpm. 
  >
  > We click 'Commit to Digital Twin': immediately, a success confirmation badge appears, the observation appears at the top of the chronological timeline tagged with **'JUST INGESTED'**, and our digital twin state is recalculated in place.
  >
  > With 33 backend tests, 5 frontend test suites, clean type-safety, and strict data tiering, SwasthyaTwin provides the mathematical foundation for personalized preventive medicine. Thank you!"*
