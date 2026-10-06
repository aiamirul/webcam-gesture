import React from 'react';
import { X, Hand, Wind, RotateCw, RotateCcw, MousePointer, Sparkles, Check, Zap, Timer, Gauge } from 'lucide-react';

interface GestureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GestureGuideModal: React.FC<GestureGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#121622] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#181e2e] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-chakra text-base font-bold text-white tracking-wide uppercase">
                Palm Wave & 2s Cooldown Guide
              </h2>
              <p className="text-xs text-slate-400 font-mono-code">
                1-Movement Limit · 2.0s Lock · 240p Turbo Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Step 1: Palm Detection & Single Movement Limit */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-[#161c2b] border border-cyan-500/20">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center font-chakra font-bold text-lg shrink-0">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-chakra text-sm font-bold text-white uppercase flex items-center gap-2">
                <span>Palm Detected $\rightarrow$ Takes Next Movement</span>
                <span className="text-[10px] font-mono-code text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                  DISCRETE WAVE
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Show your palm in front of the camera. The optical tracker arms and listens for your <strong>next movement</strong> (left or right). As soon as you wave, it captures that movement and begins the spin!
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono-code">
                <div className="p-2 rounded bg-black/40 border border-white/5 text-emerald-300 flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Wave Right: Clockwise (+)</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5 text-amber-300 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Wave Left: Counter-CW (-)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: 2-Second Cooldown Wait */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-[#161c2b] border border-amber-500/20">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-chakra font-bold text-lg shrink-0">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-chakra text-sm font-bold text-white uppercase flex items-center gap-2">
                <span>2-Second Cooldown Wait Before Next Check</span>
                <Timer className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Immediately after the movement is triggered, the system locks into a <strong>2.0-second cooldown period</strong>.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400 font-mono-code">
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>The dial continues coasting smoothly with physics inertia (45° to 180°).</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>Any extra hand twitches are ignored during the 2s countdown.</span>
                </li>
                <li className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>After 2.0s, the system re-arms for your next palm and direction check!</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Step 3: Speed-to-Physics Momentum Drift (45° to 180°) */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-[#161c2b] border border-emerald-500/20">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-chakra font-bold text-lg shrink-0">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-chakra text-sm font-bold text-white uppercase flex items-center gap-2">
                <span>Speed To Physics Drift (45° to 180°)</span>
                <Zap className="w-4 h-4 text-emerald-400" />
              </h3>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-400 font-mono-code">
                <li>• <strong>Gentle wave:</strong> Drifts through ~45 degrees</li>
                <li>• <strong>Moderate wave:</strong> Drifts through ~90 degrees</li>
                <li className="text-emerald-300 font-semibold">• <strong>Fast wave:</strong> Spins through up to 180 degrees fastest!</li>
              </ul>
            </div>
          </div>

          {/* Step 4: Processing Resolution (240p Turbo) */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-[#161c2b] border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center justify-center font-chakra font-bold text-lg shrink-0">
              <Gauge className="w-5 h-5 text-sky-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-chakra text-sm font-bold text-white uppercase">
                Optimized 240p / 360p / 480p Processing
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                By default, camera processing runs at <strong>240p (Turbo)</strong> to minimize latency to ~6ms and ensure ultra-smooth 60+ FPS tracking. You can switch to 360p or 480p anytime in the control bar!
              </p>
            </div>
          </div>

          {/* Fallback controls */}
          <div className="p-3 rounded-lg bg-black/40 border border-white/10 flex items-center gap-3 text-xs text-slate-300">
            <MousePointer className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <strong>Manual Control:</strong> You can click & drag on the knob, scroll with your mouse wheel, or use preset buttons (`0°`, `90°`, `180°`, `270°`, `360°`).
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#181e2e] border-t border-white/10 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-chakra font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Understood, Start Control
          </button>
        </div>
      </div>
    </div>
  );
};
