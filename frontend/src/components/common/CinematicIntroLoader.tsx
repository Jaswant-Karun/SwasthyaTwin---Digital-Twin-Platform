import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Activity,
  Shield,
  Zap,
  ChevronRight,
  Sparkles,
  Cpu,
  Radio
} from 'lucide-react';

interface CinematicIntroLoaderProps {
  onComplete: () => void;
  autoTransitionDelayMs?: number;
}

export const CinematicIntroLoader: React.FC<CinematicIntroLoaderProps> = ({
  onComplete,
  autoTransitionDelayMs = 3400
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<string>('Initializing Quantum Telemetry Mesh...');
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [canSkip, setCanSkip] = useState<boolean>(true);

  // Progressive telemetry checklist
  const stages = [
    { threshold: 10, label: 'Booting SwasthyaTwin Neural Subsystems...' },
    { threshold: 28, label: 'Establishing Real-Time MongoDB Telemetry Pipe...' },
    { threshold: 52, label: 'Calibrating Non-Parametric nMAD Baseline Corridors...' },
    { threshold: 76, label: 'Synthesizing Multimodal Biometric Human Twin...' },
    { threshold: 94, label: 'Synchronizing Autonomic Tone & Hemodynamic Layers...' },
    { threshold: 100, label: 'Spatial Digital Twin Ready. Engaging HUD...' }
  ];

  // Particle & holographic motion canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes for floating cybernetic grid
    const numParticles = 65;
    const particles = Array.from({ length: numParticles }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      radius: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.2
    }));

    let scanY = 0;
    let scanSpeed = 2.4;
    let pulseAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Midnight Background
      const bgGradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        50,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.8
      );
      bgGradient.addColorStop(0, '#0c192c');
      bgGradient.addColorStop(0.5, '#060c18');
      bgGradient.addColorStop(1, '#02050a');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Rotating Cybernetic Radar / Gyro Rings in Center
      pulseAngle += 0.015;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, 160, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.stroke();

      // Middle rotating ring
      ctx.rotate(pulseAngle);
      ctx.beginPath();
      ctx.arc(0, 0, 125, 0, Math.PI * 1.6);
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([16, 8]);
      ctx.stroke();

      // Counter-rotating inner ring
      ctx.rotate(-pulseAngle * 2.2);
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 1.8);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();

      ctx.restore();

      // 3. Cybernetic Laser Scanline
      scanY += scanSpeed;
      if (scanY > height) scanY = 0;

      const scanGrad = ctx.createLinearGradient(0, scanY - 25, 0, scanY + 25);
      scanGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      scanGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.22)');
      scanGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 25, width, 50);

      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(width, scanY);
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();

      // 4. Particle Constellation
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 191, ${p.alpha})`;
        ctx.fill();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.18 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Smooth progress increment
  useEffect(() => {
    const startTime = performance.now();
    const duration = autoTransitionDelayMs;

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      // Update stage text based on threshold
      const matchedStage = stages.find(s => pct <= s.threshold) || stages[stages.length - 1];
      setCurrentStage(matchedStage.label);

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          handleFinish();
        }, 350);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [autoTransitionDelayMs]);

  const handleFinish = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  return (
    <div
      className={`fixed inset-0 z-5000 flex flex-col items-center justify-between overflow-hidden transition-opacity duration-600 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#030712' }}
    >
      {/* Dynamic Background Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Top Header Controls */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        {/* Brand Logo & Protocol Identifier */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.3)]">
            <Heart className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-white">SWASTHYA</span>
              <span className="font-extrabold text-base tracking-wider text-transparent bg-clip-text bg-linear-to-r from-teal-400 to-cyan-400">
                TWIN AI
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-500/30">
                SPATIAL v2.4
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
              Multisignal Personal Health Digital Twin
            </p>
          </div>
        </div>

        {/* Skip Button */}
        {canSkip && (
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 transition-all backdrop-blur-md shadow-lg"
          >
            <span>SKIP INTRO</span>
            <ChevronRight className="w-3.5 h-3.5 text-teal-400" />
          </button>
        )}
      </div>

      {/* Center Cinematic Digital Twin Hologram Silhouette */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative w-64 h-80 sm:w-72 sm:h-96 flex items-center justify-center">
          {/* Glowing Aura Behind Avatar */}
          <div className="absolute inset-0 rounded-full bg-linear-to-b from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl animate-pulse" />

          {/* Stylized Futuristic Human Twin Avatar */}
          <svg
            viewBox="0 0 200 320"
            className="w-full h-full drop-shadow-[0_0_25px_rgba(45,212,191,0.4)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Cybernetic Grid Contour Lines */}
            <path
              d="M100 25 C112 25 120 35 120 48 C120 62 112 70 100 70 C88 70 80 62 80 48 C80 35 88 25 100 25 Z"
              stroke="#2dd4bf"
              strokeWidth="1.8"
              strokeDasharray="3 3"
              className="animate-pulse"
            />
            {/* Head node */}
            <circle cx="100" cy="48" r="4" fill="#38bdf8" />

            {/* Neck to Torso */}
            <path
              d="M100 70 L100 85 M82 88 L118 88 L135 110 L145 165 L140 205 M65 110 L55 165 L60 205"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Spine Axis */}
            <line x1="100" y1="88" x2="100" y2="200" stroke="#14b8a6" strokeWidth="2" strokeDasharray="4 4" />

            {/* Ribcage / Cardiac Corridor */}
            <path
              d="M85 105 Q100 115 115 105 M80 120 Q100 132 120 120 M83 138 Q100 148 117 138"
              stroke="#2dd4bf"
              strokeWidth="1.2"
              opacity="0.75"
            />

            {/* Cardiac Core Node (Pulsing Heart) */}
            <circle cx="94" cy="118" r="7" fill="#f43f5e" className="animate-ping" opacity="0.6" />
            <circle cx="94" cy="118" r="4.5" fill="#f43f5e" />

            {/* Pelvis & Legs */}
            <path
              d="M85 195 L115 195 L125 245 L120 305 M85 195 L75 245 L80 305"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.85"
            />

            {/* Kinetic Foot Nodes */}
            <circle cx="80" cy="305" r="3.5" fill="#2dd4bf" />
            <circle cx="120" cy="305" r="3.5" fill="#2dd4bf" />

            {/* Radial Synapse Rings */}
            <circle cx="100" cy="48" r="18" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.6" />
            <circle cx="94" cy="118" r="22" stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.5" />
          </svg>

          {/* HUD Floating Diagnostic Pills */}
          <div className="absolute top-2 -left-8 sm:-left-12 px-2.5 py-1 rounded-md bg-slate-900/80 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-bounce">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>NEURAL_TWIN</span>
          </div>

          <div className="absolute top-28 -right-8 sm:-right-12 px-2.5 py-1 rounded-md bg-slate-900/80 border border-rose-500/30 text-[10px] font-mono text-rose-300 shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-pulse">
            <Radio className="w-3 h-3 text-rose-400" />
            <span>HEMODYNAMICS</span>
          </div>

          <div className="absolute bottom-6 -left-6 sm:-left-10 px-2.5 py-1 rounded-md bg-slate-900/80 border border-teal-500/30 text-[10px] font-mono text-teal-300 shadow-lg backdrop-blur-md flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-teal-400" />
            <span>nMAD_ENGINE</span>
          </div>
        </div>

        {/* Cinematic Progress Text */}
        <div className="text-center mt-2 space-y-1">
          <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>{progress}%</span>
            <span className="text-xs font-normal text-teal-400 tracking-normal font-sans">
              CALIBRATED
            </span>
          </div>
          <p className="text-xs text-slate-300 font-mono tracking-wide h-4 animate-pulse">
            {currentStage}
          </p>
        </div>
      </div>

      {/* Bottom Telemetry Bar & Progress Indicator */}
      <div className="relative z-10 w-full max-w-xl mx-auto px-6 pb-8 space-y-4">
        {/* Glowing Progress Track */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-[1px]">
            <div
              className="h-full bg-linear-to-r from-teal-400 via-cyan-400 to-sky-400 rounded-full transition-all duration-100 shadow-[0_0_15px_rgba(45,212,191,0.8)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>SYS_INTEGRITY: 100%</span>
            <span>MONGODB: CONNECTED</span>
            <span>BIOMETRICS: SYNCHRONIZED</span>
          </div>
        </div>

        {/* Live ECG Waveform Animation Trace */}
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-mono text-teal-300">
            <Activity className="w-4 h-4 text-teal-400 animate-pulse" />
            <span>CARDIAC_SIGNAL_LOCK</span>
          </div>

          {/* SVG Animated Pulse Line */}
          <div className="flex-1 max-w-[200px] h-6 overflow-hidden">
            <svg viewBox="0 0 160 30" className="w-full h-full" fill="none">
              <path
                d="M0 15 L35 15 L45 5 L55 25 L65 10 L75 18 L85 15 L160 15"
                stroke="#2dd4bf"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-90"
              />
            </svg>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            <span className="text-white font-bold">72</span> BPM
          </div>
        </div>

        {/* Direct Action when complete */}
        {progress >= 100 && (
          <div className="text-center pt-1 animate-fade-in">
            <button
              onClick={handleFinish}
              className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-linear-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 shadow-[0_0_25px_rgba(45,212,191,0.6)] transition-all cursor-pointer transform hover:scale-105 active:scale-95"
            >
              Enter Digital Twin Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
