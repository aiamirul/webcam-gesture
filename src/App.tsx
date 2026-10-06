import React, { useState, useCallback } from 'react';
import {
  Volume2,
  Sun,
  Hand,
  VolumeX,
  Volume1,
  RotateCw,
  Sparkles,
  HelpCircle,
  Cpu,
} from 'lucide-react';
import { RotaryKnob } from './components/RotaryKnob';
import { WebcamTracker } from './components/WebcamTracker';
import { VolumeDashboard } from './components/VolumeDashboard';
import { BrightnessDashboard } from './components/BrightnessDashboard';
import { GestureGuideModal } from './components/GestureGuideModal';
import { soundEngine } from './services/soundEffects';
import type {
  ControllerMode,
  GestureDetectionState,
  VolumeState,
  BrightnessState,
} from './types';

export default function App() {
  const [mode, setMode] = useState<ControllerMode>('volume');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [soundClicksEnabled, setSoundClicksEnabled] = useState(true);

  // Knob state for Volume (0 to 360 degrees)
  const [volumeState, setVolumeState] = useState<VolumeState>({
    angle: 180, // 50% default
    percentage: 50,
    db: -30.0,
    muted: false,
    isPlaying: false,
    soundPreset: 'synthwave',
  });

  // Knob state for Brightness (0 to 360 degrees)
  const [brightnessState, setBrightnessState] = useState<BrightnessState>({
    angle: 216, // 60% default (~720 nits)
    percentage: 60,
    nits: 724,
    colorTempK: 6500,
    scene: 'cyber_neon',
  });

  // Current active angle based on mode
  const currentAngle = mode === 'volume' ? volumeState.angle : brightnessState.angle;

  // Live gesture state from WebcamTracker
  const [gestureState, setGestureState] = useState<GestureDetectionState>({
    handDetected: false,
    isGrabbing: false,
    gestureAction: 'idle',
    confidence: 0,
    pinchDistance: 1.0,
    pinchThreshold: 0.38,
    gripCenter: null,
    wristPosition: null,
    palmPosition: null,
    palmBox: null,
    rawAngle: 0,
    angleDelta: 0,
    direction: 'static',
    handedness: 'Unknown',
    controlMode: 'palm_drift',
    palmVelocityX: 0,
    palmSpeed: 0,
    isWaving: false,
    waveDirection: 'none',
    angularVelocity: 0,
    isDrifting: false,
    totalWaveDriftDeg: 0,
    isCoolingDown: false,
    cooldownRemainingMs: 0,
    cooldownDurationMs: 2000,
  });

  // Update knob angle directly (from mouse drag, wheel, or presets)
  const handleAngleChange = useCallback(
    (newAngle: number) => {
      // Clamped or wrapped in 0..360
      const clamped = Math.max(0, Math.min(360, Math.round(newAngle)));

      if (soundClicksEnabled) {
        soundEngine.playKnobTick(clamped);
      }

      if (mode === 'volume') {
        const pct = Math.round((clamped / 360) * 100);
        const db = clamped === 0 ? -60 : -60 + (clamped / 360) * 60;
        setVolumeState((prev) => ({
          ...prev,
          angle: clamped,
          percentage: pct,
          db,
        }));
      } else {
        const pct = Math.round((clamped / 360) * 100);
        const nits = Math.round(10 + (clamped / 360) * 1190);
        setBrightnessState((prev) => ({
          ...prev,
          angle: clamped,
          percentage: pct,
          nits,
        }));
      }
    },
    [mode, soundClicksEnabled]
  );

  // Update knob angle by delta (from real-time webcam gesture rotation)
  const handleAngleDelta = useCallback(
    (delta: number, isGrabbing: boolean) => {
      if (!isGrabbing) return;

      const current = mode === 'volume' ? volumeState.angle : brightnessState.angle;
      // Increment or decrement according to hand rotation direction
      let next = current + delta;
      // Clamp smoothly between 0 and 360 degrees
      next = Math.max(0, Math.min(360, next));

      if (soundClicksEnabled) {
        soundEngine.playKnobTick(Math.round(next));
      }

      if (mode === 'volume') {
        const pct = Math.round((next / 360) * 100);
        const db = next === 0 ? -60 : -60 + (next / 360) * 60;
        setVolumeState((prev) => ({
          ...prev,
          angle: next,
          percentage: pct,
          db,
        }));
      } else {
        const pct = Math.round((next / 360) * 100);
        const nits = Math.round(10 + (next / 360) * 1190);
        setBrightnessState((prev) => ({
          ...prev,
          angle: next,
          percentage: pct,
          nits,
        }));
      }
    },
    [mode, volumeState.angle, brightnessState.angle, soundClicksEnabled]
  );

  // Dynamic ambient backdrop illumination based on mode & dial value
  const ambientGlow =
    mode === 'volume'
      ? `radial-gradient(ellipse at 50% 20%, rgba(6, 182, 212, ${
          0.04 + (volumeState.angle / 360) * 0.12
        }) 0%, transparent 60%)`
      : `radial-gradient(ellipse at 50% 20%, rgba(245, 158, 11, ${
          0.04 + (brightnessState.angle / 360) * 0.16
        }) 0%, transparent 60%)`;

  return (
    <div
      className="min-h-screen bg-[#0b0d13] text-slate-100 flex flex-col relative transition-all duration-300"
      style={{
        backgroundImage: ambientGlow,
      }}
    >
      {/* Top Header & Console Controls */}
      <header className="border-b border-white/10 bg-[#0e111a]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand & System Status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
              <RotateCw className="w-5 h-5 text-slate-950" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-chakra text-lg font-bold tracking-tight text-white uppercase">
                  AuraDial
                </h1>
                <span className="text-[11px] font-mono-code text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                  v2.4 TF.JS
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono-code">
                Real-Time Hand Gesture 360° Rotary Controller
              </p>
            </div>
          </div>

          {/* Interactive Mode Switcher (Volume vs Screen Brightness) */}
          <div className="flex items-center bg-[#141824] p-1 rounded-xl border border-white/10 shadow-inner">
            <button
              onClick={() => setMode('volume')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-chakra font-bold tracking-wide uppercase transition-all cursor-pointer ${
                mode === 'volume'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Digital Volume</span>
            </button>

            <button
              onClick={() => setMode('brightness')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-chakra font-bold tracking-wide uppercase transition-all cursor-pointer ${
                mode === 'brightness'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Screen Brightness</span>
            </button>
          </div>

          {/* Utility Buttons: Sound Clicks, Guide, Status */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundClicksEnabled(!soundClicksEnabled)}
              title={soundClicksEnabled ? 'Tactile Clicks On' : 'Tactile Clicks Muted'}
              className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                soundClicksEnabled
                  ? 'bg-white/5 border-white/10 text-cyan-300 hover:bg-white/10'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {soundClicksEnabled ? <Volume1 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-chakra font-medium tracking-wide transition-colors cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span>How To Grab</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Studio Workstation Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col gap-8">
        
        {/* Real-time Gesture State Banner */}
        <div className="rounded-xl bg-[#121622] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                gestureState.isGrabbing
                  ? 'bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse'
                  : gestureState.handDetected
                  ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                  : 'bg-slate-600'
              }`}
            />
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="font-chakra text-xs font-bold text-white uppercase tracking-wider">
                Optical Gesture Engine:
              </span>
              <span
                className={`font-mono-code text-xs font-semibold ${
                  gestureState.isCoolingDown
                    ? 'text-amber-300'
                    : gestureState.isWaving
                    ? 'text-emerald-400'
                    : gestureState.isDrifting
                    ? 'text-sky-300'
                    : gestureState.isGrabbing
                    ? 'text-emerald-400'
                    : gestureState.handDetected
                    ? 'text-cyan-300'
                    : 'text-slate-400'
                }`}
              >
                {gestureState.isCoolingDown ? (
                  `WAITING 2.0s FOR NEXT PALM CHECK [ ${(gestureState.cooldownRemainingMs / 1000).toFixed(1)}s ] · COASTING`
                ) : gestureState.isWaving ? (
                  gestureState.waveDirection === 'right' ? (
                    `PALM WAVE RIGHT >>> [+${Math.round(gestureState.totalWaveDriftDeg || 45)}° PHYSICS DRIFT]`
                  ) : (
                    `<<< PALM WAVE LEFT [ -${Math.round(gestureState.totalWaveDriftDeg || 45)}° PHYSICS DRIFT ]`
                  )
                ) : gestureState.isDrifting ? (
                  `PHYSICS INERTIA DRIFTING... (${Math.abs(gestureState.angularVelocity * 10).toFixed(0)}°/S)`
                ) : gestureState.isGrabbing ? (
                  gestureState.direction === 'cw' ? (
                    'GRAB DETECTED · ROTATING RIGHT [CW INCREMENT]'
                  ) : gestureState.direction === 'ccw' ? (
                    'GRAB DETECTED · ROTATING LEFT [CCW DECREMENT]'
                  ) : (
                    'GRAB DETECTED · DIAL ENGAGED (TWIST HAND)'
                  )
                ) : gestureState.handDetected ? (
                  gestureState.controlMode === 'palm_drift'
                    ? 'PALM ARMED · MOVE LEFT OR RIGHT (1 MOVEMENT -> 2s WAIT)'
                    : 'HAND READY IN VIEW · PINCH THUMB & INDEX TO GRAB'
                ) : (
                  'LOOKING FOR HAND GESTURE (WAVE PALM LEFT/RIGHT OR CLICK & DRAG)'
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-code text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Angle:</span>
              <span className="text-white font-bold">{Math.round(currentAngle)}°</span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Value:</span>
              <span className="text-cyan-300 font-bold">
                {Math.round((currentAngle / 360) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Studio Centerpiece Layout: Left = 360 Knob, Right = Tracker & Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left / Center: Tactile 360-Degree Precision Rotary Dial */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 sm:p-10 rounded-2xl bg-[#11151f]/80 backdrop-blur-md border border-white/10 shadow-2xl relative min-h-[580px]">
            
            {/* Corner Decorative High-Tech Machine Labels */}
            <div className="absolute top-4 left-4 text-[10px] font-mono-code text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-500" />
              <span>Rotary Precision Unit 01</span>
            </div>
            
            <div className="absolute top-4 right-4 text-[10px] font-mono-code text-slate-500 uppercase tracking-widest">
              Range: 000° — 360°
            </div>

            {/* The Precision Interactive Knob */}
            <div className="my-auto py-4">
              <RotaryKnob
                mode={mode}
                angle={currentAngle}
                isGrabbing={gestureState.isGrabbing}
                gestureDirection={gestureState.direction}
                onAngleChange={handleAngleChange}
                size={380}
                isDrifting={gestureState.isDrifting}
                isWaving={gestureState.isWaving}
                waveDirection={gestureState.waveDirection}
                isCoolingDown={gestureState.isCoolingDown}
                cooldownRemainingMs={gestureState.cooldownRemainingMs}
              />
            </div>

            {/* Visual Instructions & Mode Pill */}
            <div className="mt-4 w-full flex items-center justify-between text-xs text-slate-400 font-mono-code border-t border-white/5 pt-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>
                  {mode === 'volume' ? 'Audio Attenuation' : 'Display PWM Lumens'}
                </span>
              </div>
              <div className="text-slate-500">
                0° Min · 180° Mid · 360° Max
              </div>
            </div>

          </div>

          {/* Right Column: AI Optical Tracker + Mode Dashboard */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            
            {/* Real-time Webcam Hand Tracker Component */}
            <WebcamTracker
              onAngleDelta={handleAngleDelta}
              onGestureStateChange={setGestureState}
              currentKnobAngle={currentAngle}
              onOpenGuide={() => setIsGuideOpen(true)}
            />

            {/* Mode-Specific Interactive Visual Dashboard */}
            {mode === 'volume' ? (
              <VolumeDashboard
                volumeState={volumeState}
                onUpdateState={(part) => setVolumeState((p) => ({ ...p, ...part }))}
              />
            ) : (
              <BrightnessDashboard
                brightnessState={brightnessState}
                onUpdateState={(part) => setBrightnessState((p) => ({ ...p, ...part }))}
              />
            )}

          </div>

        </div>

        {/* Feature Highlights & Specifications */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
          <div className="p-4 rounded-xl bg-[#121622] border border-white/5">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-chakra font-bold uppercase mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Real-Time Neural Tracking</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Processes 21 high-fidelity 3D hand keypoints entirely on client-side WebGL via TensorFlow.js for zero latency and private camera processing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#121622] border border-white/5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-chakra font-bold uppercase mb-1">
              <Hand className="w-4 h-4" />
              <span>Natural Knob Grasp</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dynamically measures normalized Euclidean thumb-to-index pinch ratio and tracks wrist rotation vectors to mirror physical dial movement.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#121622] border border-white/5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-chakra font-bold uppercase mb-1">
              <RotateCw className="w-4 h-4" />
              <span>Precision 0° to 360° Scale</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              72 machined tick marks with audible mechanical haptic feedback, real Web Audio DSP playback, and HDR display calibration presets.
            </p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 px-6 text-center text-xs text-slate-500 font-mono-code">
        AuraDial · Client-Side TensorFlow.js Hand Gesture Rotary Interface · 0° to 360° Continuous Control
      </footer>

      {/* Guide Modal */}
      <GestureGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
