"""
Generate high-resolution architecture diagram and presentation deck PDFs
for SwasthyaTwin AI hackathon submission package using matplotlib vector rendering.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.patches as patches

DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs")
os.makedirs(DOCS_DIR, exist_ok=True)

ARCH_PDF_PATH = os.path.join(DOCS_DIR, "architecture-diagram.pdf")
PRES_PDF_PATH = os.path.join(DOCS_DIR, "project-presentation.pdf")

def create_architecture_diagram_pdf():
    print(f"Generating Architecture Diagram PDF at: {ARCH_PDF_PATH}")
    fig = plt.figure(figsize=(14, 9), facecolor='#060a14')
    ax = fig.add_axes([0, 0, 1, 1], facecolor='#060a14')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Title Banner
    ax.text(50, 95, "SWASTHYATWIN AI — TECHNICAL SYSTEM ARCHITECTURE", 
            color='#22d3ee', fontsize=18, fontweight='bold', ha='center', va='center', fontfamily='sans-serif')
    ax.text(50, 92, "Multimodal Telemetry Ingestion • Causal BiDSleep ML • Mathematical Transparency • MongoDB Persistence", 
            color='#94a3b8', fontsize=10, ha='center', va='center', fontfamily='sans-serif')

    def draw_box(x, y, w, h, title, subtitle, color, border_color):
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.5,rounding_size=1.5",
                                     facecolor=color, edgecolor=border_color, linewidth=1.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 3, title, color='#ffffff', fontsize=11, fontweight='bold', ha='center', va='center')
        ax.text(x + w/2, y + h/2 - 1, subtitle, color='#cbd5e1', fontsize=8.5, ha='center', va='center', multialignment='center')

    # 1. Client Layer
    draw_box(4, 68, 92, 19, 
             "CLIENT LAYER (React 19 + TypeScript + Vite + TailwindCSS)", 
             "• Spatial Human Hologram Locator (SVG Vectors, 6 Subsystems: Keys 1-6)    • Multi-Signal Timeline with Provenance Badges\n"
             "• Universal 'How is this calculated?' Explainability Modals                • What-If Counterfactual Simulator Workspace\n"
             "• Sleep Intelligence & Dual-Track EEG vs PPG Hypnogram                   • Real-Time MongoDB Health & Latency Probe",
             '#091426', '#06b6d4')

    # Arrow from Client to Gateway
    ax.annotate('', xy=(50, 60), xytext=(50, 68),
                arrowprops=dict(arrowstyle="->", color='#22d3ee', lw=2.5))
    ax.text(51, 64, "REST / JSON over HTTPS (Pydantic v2 Contracts)", color='#22d3ee', fontsize=9, fontweight='bold')

    # 2. API Gateway
    draw_box(15, 45, 70, 15,
             "FASTAPI APPLICATION GATEWAY & SECURITY",
             "• CORS Whitelisting & Constant-Time HMAC Bearer Token / API-Key Verification\n"
             "• Multi-Tenant Isolation: Mandatory {'patient_id': id} Query Scoping on All Operations\n"
             "• AI Plausibility Guard: Typo Rejection (e.g., HR=700 bpm or SBP < DBP flagged 409 Conflict)\n"
             "• Public Path Sanitization: Local Server Directory Scrubbing & Credential Masking in Logs",
             '#0b1a30', '#14b8a6')

    # Arrow from Gateway to Core Analytics
    ax.annotate('', xy=(32, 38), xytext=(32, 45),
                arrowprops=dict(arrowstyle="->", color='#14b8a6', lw=2.0))
    ax.annotate('', xy=(68, 38), xytext=(68, 45),
                arrowprops=dict(arrowstyle="->", color='#14b8a6', lw=2.0))

    # 3. Analytics & ML Engines
    draw_box(4, 18, 44, 20,
             "ANALYTICS & COMPUTATION ENGINE",
             "• Robust Baseline Corridor: nMAD = 1.4826 * MAD\n"
             "• Target Self-Exclusion & >=14 Obs Minimum Gate\n"
             "• Personal Z-Score Anomaly Detector (Floor >= 1.0 bpm)\n"
             "• Explainable Vitality Index Deduction Model (0-100)\n"
             "• What-If Exponential Saturation Recovery Kinetics",
             '#0a1829', '#38bdf8')

    draw_box(52, 18, 44, 20,
             "MACHINE LEARNING INFERENCE ENGINE",
             "• PhysioNet BiDSleep v1.0.1 (31 Subjects, 15.7k Epochs)\n"
             "• 12 Causal Temporal Features (0% Future Data Leakage)\n"
             "• Class-Weighted Random Forest (150 trees, depth 12)\n"
             "• Held-Out Evaluation: Macro F1 28.22% (+18.69% lift)\n"
             "• Sensor Dropout Guard: valid_count < 2.0 -> Unknown",
             '#111638', '#a855f7')

    # Arrow from Engines to Storage
    ax.annotate('', xy=(50, 11), xytext=(50, 18),
                arrowprops=dict(arrowstyle="->", color='#38bdf8', lw=2.5))

    # 4. Storage Layer
    draw_box(10, 2, 80, 9,
             "DATA PERSISTENCE LAYER (MongoDB 7.0 + In-Memory Fallback)",
             "Collections: db.patients (Demographics)  |  db.observations (Canonical Units)  |  db.health_assessments (Decay)\n"
             "db.simulations (Isolated What-If Scenarios)  |  db.alerts (Deduplicated Flags)  |  db.audit_events (Scrubbed)",
             '#06131f', '#10b981')

    fig.savefig(ARCH_PDF_PATH, dpi=300, facecolor='#060a14')
    plt.close(fig)
    print("Architecture Diagram PDF generated successfully.")

def create_presentation_pdf():
    print(f"Generating Presentation Deck PDF at: {PRES_PDF_PATH}")
    
    slides = [
        {
            "num": "1 / 8",
            "title": "SwasthyaTwin AI — Multisignal Health Intelligence",
            "subtitle": "Happiest Health Digital Twin Challenge 2026 | Team: 24cb012",
            "bullets": [
                "Team Name: 24cb012",
                "Team Leader: Gangeswara S",
                "Team Members: Bharanika D, Jaswant karun S A, Baviya Varshini V",
                "Affiliation: [TODO: Add College / Institution Name & Department]",
                "Vision: Understand today. Prepare for tomorrow.",
                "Clinical Status: Proof-of-Concept Research Prototype (Non-Diagnostic Software)"
            ],
            "accent": "#22d3ee"
        },
        {
            "num": "2 / 8",
            "title": "The Healthcare Challenge & Target Users",
            "subtitle": "The Failure of Generic Population Averages",
            "bullets": [
                "Population Norm Bias: Legacy apps compare everyone to 60-100 bpm population norms.",
                "Missed Drift: An athlete (resting HR 46 bpm) drifting to 62 bpm is marked 'Normal'.",
                "Opaque Scoring: Proprietary black-box sleep and readiness scores cannot be audited.",
                "Target User 1: Proactive individuals seeking early personal baseline deviation detection.",
                "Target User 2: Preventive clinicians needing transparent mathematical audit trails."
            ],
            "accent": "#f43f5e"
        },
        {
            "num": "3 / 8",
            "title": "Why a Digital Twin Approach?",
            "subtitle": "Self-Baseline Grounding & Prospective In-Silico Simulation",
            "bullets": [
                "Continuous Biological Modeling: Calibrated dynamically to an individual's personal history.",
                "Anti-Population Norms: Uses normalized median absolute deviation (nMAD) for robust corridors.",
                "Counterfactual 'What-If' Sandbox: Models lifestyle interventions (e.g. +1.5h sleep) in-silico.",
                "Data Isolation Guarantee: Simulations write to db.simulations and NEVER mutate measured history.",
                "100% Explainability: Universal 'How Calculated' modals expose formulas and arithmetic."
            ],
            "accent": "#06b6d4"
        },
        {
            "num": "4 / 8",
            "title": "Distinctive Innovations of SwasthyaTwin AI",
            "subtitle": "What Sets This Platform Apart",
            "bullets": [
                "Autonomous Spatial Twin: Dark spatial canvas with 6 organ subsystems and hotkeys (1-6).",
                "Schematic Vector Topology: Explicit locator notice prevents CT/MRI diagnostic confusion.",
                "5-Tier Data Provenance: MEASURED, DERIVED, PREDICTED, SIMULATED, SYNTHETIC.",
                "Universal Mathematical Modals: Step-by-step arithmetic matching displayed telemetry.",
                "Zero-Crash Resilience: Automatic mongomock fallback for offline demonstration."
            ],
            "accent": "#14b8a6"
        },
        {
            "num": "5 / 8",
            "title": "Technical Architecture & Data Flow",
            "subtitle": "Modern Full-Stack Engineering with Zero Shortcuts",
            "bullets": [
                "Frontend: React 19, TypeScript, Vite v8.3.4, Tailwind CSS, Recharts (Build: 2.08s).",
                "Backend: Python 3.13, FastAPI, Pydantic v2 (Strict canonical units: bpm, mmHg, hrs).",
                "Database: MongoDB 7.0 with compound indexing on patient_id and descending timestamps.",
                "AI Plausibility Guard: Rejects impossible vitals (HR=700 bpm, SBP < DBP) before storage.",
                "Multi-Tenant Isolation: Mandatory {'patient_id': id} scoping blocks cross-tenant leakage."
            ],
            "accent": "#38bdf8"
        },
        {
            "num": "6 / 8",
            "title": "Machine Learning Contribution & Real Evaluation",
            "subtitle": "PhysioNet BiDSleep 5-Stage AASM Sleep Model",
            "bullets": [
                "Real Dataset: PhysioNet BiDSleep v1.0.1 (31 adult participants, 15,765 30s epochs).",
                "Disjoint Group Partitioning: Bidslab00 (Train), Bidslab01 (Val), Bidslab02 (Test).",
                "Zero Participant & Preprocessing Leakage: RobustScaler fit strictly on training set.",
                "Held-Out Subject Bidslab02 (5,280 epochs / 44 hrs): Macro F1 28.22% (+18.69% lift).",
                "Balanced Accuracy: 34.70% (+14.70% lift) | Sensor dropout (<2.0 samples) -> Unknown."
            ],
            "accent": "#a855f7"
        },
        {
            "num": "7 / 8",
            "title": "3-Minute Live Demonstration Workflow",
            "subtitle": "Repeatable End-to-End Walkthrough",
            "bullets": [
                "Step 1: Flagship Spatial Twin — Press 1-6 for instant organ telemetry & baseline corridors.",
                "Step 2: Patient Switching — Switch to PT-1001 (Aarav Mehta) or PT-1003 (48 bpm athlete).",
                "Step 3: Plausibility Guard — Input 999 bpm -> instant rejection; input 74 bpm -> persisted.",
                "Step 4: Explainability Modal — Inspect Modified Z derivation and Vitality deductions.",
                "Step 5: Sleep Research Workspace — 120-epoch dual hypnogram (Dreem 2 EEG vs PPG model).",
                "Step 6: What-If Simulator — Run +1.5h sleep scenario; show recovery curve in isolated db."
            ],
            "accent": "#10b981"
        },
        {
            "num": "8 / 8",
            "title": "Safety, Limitations & Future Roadmap",
            "subtitle": "Responsible AI in Healthcare",
            "bullets": [
                "Clinical Boundary: Non-diagnostic prototype; does not diagnose arrhythmias or apnea.",
                "Zero Imputation Policy: Missing sensor intervals are NEVER filled with synthetic zeros.",
                "History Gating: Minimum 14 observations enforced before establishing statistical corridor.",
                "Verification Evidence: 282 automated tests passed (227 Pytest + 55 Vitest, 0 failures).",
                "Next Steps: Web Bluetooth Low Energy (BLE) packet ingest & SMART-on-FHIR EHR sync."
            ],
            "accent": "#fbbf24"
        }
    ]

    with PdfPages(PRES_PDF_PATH) as pdf:
        for slide in slides:
            fig = plt.figure(figsize=(13.33, 7.5), facecolor='#060a14')
            ax = fig.add_axes([0, 0, 1, 1], facecolor='#060a14')
            ax.set_xlim(0, 100)
            ax.set_ylim(0, 100)
            ax.axis('off')

            # Top branding
            ax.text(6, 92, "SWASTHYATWIN AI", color=slide['accent'], fontsize=12, fontweight='bold', fontfamily='sans-serif')
            ax.text(94, 92, slide['num'], color='#64748b', fontsize=12, fontweight='bold', ha='right', fontfamily='sans-serif')

            # Slide Header
            ax.text(6, 84, slide['title'], color='#ffffff', fontsize=20, fontweight='bold', fontfamily='sans-serif')
            ax.text(6, 78, slide['subtitle'], color=slide['accent'], fontsize=13, fontfamily='sans-serif')

            # Divider line
            ax.plot([6, 94], [74, 74], color='#1e293b', lw=1.5)

            # Bullet points
            y = 66
            for bullet in slide['bullets']:
                ax.plot(8, y, marker='o', markersize=6, color=slide['accent'])
                ax.text(11, y, bullet, color='#e2e8f0', fontsize=12, va='center', fontfamily='sans-serif')
                y -= 10

            # Footer
            ax.text(6, 6, "Happiest Health Digital Twin Challenge 2026 • Non-Diagnostic Research Prototype", 
                    color='#475569', fontsize=9, fontfamily='sans-serif')

            pdf.savefig(fig, dpi=300, facecolor='#060a14')
            plt.close(fig)

    print("Presentation Deck PDF generated successfully.")

if __name__ == "__main__":
    create_architecture_diagram_pdf()
    create_presentation_pdf()
