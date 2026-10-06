import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Volume2, Sun, RotateCw, RotateCcw } from 'lucide-react';
import type { ControllerMode } from '../types';

interface RotaryKnobProps {
  mode: ControllerMode;
  angle: number; // 0 to 360
  isGrabbing: boolean;
  gestureDirection: 'cw' | 'ccw' | 'static';
  onAngleChange: (newAngle: number) => void;
  accentColor?: string; // hex or tailwind class
  size?: number; // diameter in pixels (default 360)
  isDrifting?: boolean;
  isWaving?: boolean;
  waveDirection?: 'left' | 'right' | 'none';
  isCoolingDown?: boolean;
  cooldownRemainingMs?: number;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  mode,
  angle,
  isGrabbing,
  gestureDirection,
  onAngleChange,
  size = 360,
  isDrifting = false,
  isWaving = false,
  waveDirection = 'none',
  isCoolingDown = false,
  cooldownRemainingMs = 0,
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [dragStartAngle, setDragStartAngle] = useState(0);
  const [initialAngleOnDrag, setInitialAngleOnDrag] = useState(0);

  const radius = size / 2;
  const strokeWidth = 10;
  const arcRadius = radius - 38;
  const circumference = 2 * Math.PI * arcRadius;
  const arcOffset = circumference - (angle / 360) * circumference;

  // Percentage (0 - 100)
  const percentage = Math.round((angle / 360) * 100);

  // Calculate mouse angle relative to knob center
  const getMouseAngle = useCallback((clientX: number, clientY: number): number => {
    if (!knobRef.current) return 0;
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // 0 at top
    if (deg < 0) deg += 360;
    return deg;
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMouseDragging(true);
    const startAng = getMouseAngle(e.clientX, e.clientY);
    setDragStartAngle(startAng);
    setInitialAngleOnDrag(angle);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDragging) return;
      const currentAng = getMouseAngle(e.clientX, e.clientY);
      let diff = currentAng - dragStartAngle;
      // Normalizing diff
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;

      let newAngle = (initialAngleOnDrag + diff) % 360;
      if (newAngle < 0) newAngle += 360;
      onAngleChange(Math.round(newAngle));
    };

    const handleMouseUp = () => {
      if (isMouseDragging) {
        setIsMouseDragging(false);
      }
    };

    if (isMouseDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMouseDragging, dragStartAngle, initialAngleOnDrag, getMouseAngle, onAngleChange]);

  // Wheel handling for fine-grain tuning
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.deltaY > 0 ? -3 : 3;
    let next = (angle + step) % 360;
    if (next < 0) next += 360;
    onAngleChange(Math.round(next));
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 2;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -2;
    else if (e.key === 'PageUp') delta = 15;
    else if (e.key === 'PageDown') delta = -15;
    else if (e.key === 'Home') onAngleChange(0);
    else if (e.key === 'End') onAngleChange(360);

    if (delta !== 0) {
      e.preventDefault();
      let next = (angle + delta) % 360;
      if (next < 0) next += 360;
      onAngleChange(Math.round(next));
    }
  };

  const isVolume = mode === 'volume';
  const primaryGlow = isVolume ? 'rgba(6, 182, 212, 0.45)' : 'rgba(245, 158, 11, 0.45)';
  const activeColor = isVolume ? '#06b6d4' : '#f59e0b';
  const activeBg = isVolume ? 'text-cyan-400' : 'text-amber-400';

  // Generate tick marks (72 ticks around the circle = every 5 degrees)
  const ticks = Array.from({ length: 72 }).map((_, i) => {
    const tickDeg = i * 5;
    const isMajor = tickDeg % 30 === 0;
    const isSemiMajor = tickDeg % 15 === 0 && !isMajor;
    const isActive = tickDeg <= angle;
    const tickLength = isMajor ? 14 : isSemiMajor ? 9 : 5;
    const r1 = radius - 18;
    const r2 = r1 - tickLength;
    const rad = ((tickDeg - 90) * Math.PI) / 180;
    const x1 = radius + r1 * Math.cos(rad);
    const y1 = radius + r1 * Math.sin(rad);
    const x2 = radius + r2 * Math.cos(rad);
    const y2 = radius + r2 * Math.sin(rad);

    return {
      id: i,
      deg: tickDeg,
      isMajor,
      isActive,
      x1,
      y1,
      x2,
      y2,
    };
  });

  // Major cardinal labels
  const degreeLabels = [0, 45, 90, 135, 180, 225, 270, 315, 360];

  return (
    <div className="flex flex-col items-center select-none">
      {/* Outer Glow Halo when grabbed */}
      <div
        ref={knobRef}
        tabIndex={0}
        role="slider"
        aria-label={`${isVolume ? 'Volume' : 'Brightness'} Knob`}
        aria-valuenow={angle}
        aria-valuemin={0}
        aria-valuemax={360}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        className={`relative rounded-full cursor-grab active:cursor-grabbing focus:outline-none transition-shadow duration-300 ${
          isGrabbing ? 'ring-4 ring-offset-4 ring-offset-[#0b0d13]' : 'focus-visible:ring-2 focus-visible:ring-cyan-500/50'
        }`}
        style={{
          width: size,
          height: size,
          boxShadow: isGrabbing
            ? `0 0 60px ${primaryGlow}, inset 0 0 40px rgba(0,0,0,0.8)`
            : '0 20px 45px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255,255,255,0.06)',
        }}
      >
        {/* Outer Knurled Metal Bezel */}
        <div className="absolute inset-0 rounded-full knob-bezel p-[10px] shadow-2xl">
          {/* Inner Dark Cavity */}
          <div className="relative w-full h-full rounded-full bg-[#0d1017] border border-white/5 flex items-center justify-center overflow-hidden">
            
            {/* Ambient Background Grid and Radial Gradient */}
            <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]" />

            {/* SVG Precision Dial Markings */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${size} ${size}`}
            >
              <defs>
                <linearGradient id="arcGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0891b2" />
                  <stop offset="70%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#67e8f9" />
                </linearGradient>
                <linearGradient id="arcGradAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="70%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#fde68a" />
                </linearGradient>
                <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Inactive track ring */}
              <circle
                cx={radius}
                cy={radius}
                r={arcRadius}
                fill="none"
                stroke="#1e2533"
                strokeWidth={strokeWidth}
                strokeDasharray="3 3"
              />

              {/* Active Progress Arc */}
              <circle
                cx={radius}
                cy={radius}
                r={arcRadius}
                fill="none"
                stroke={isVolume ? 'url(#arcGradCyan)' : 'url(#arcGradAmber)'}
                strokeWidth={strokeWidth + 2}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={arcOffset}
                transform={`rotate(-90 ${radius} ${radius})`}
                filter="url(#glowFilter)"
                className="transition-all duration-75"
              />

              {/* Precision 360-degree ticks */}
              {ticks.map((t) => (
                <line
                  key={t.id}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={
                    t.isActive
                      ? activeColor
                      : t.isMajor
                      ? '#475569'
                      : '#1e293b'
                  }
                  strokeWidth={t.isMajor ? (t.isActive ? 2.5 : 2) : 1}
                  opacity={t.isActive ? 1 : 0.75}
                />
              ))}

              {/* Numbered Degree Indicators */}
              {degreeLabels.map((deg) => {
                const is360 = deg === 360;
                const displayAngle = is360 ? 360 : deg;
                const anglePos = is360 ? 359.5 : deg; // Position slightly at top right for 360 label
                const rad = ((anglePos - 90) * Math.PI) / 180;
                const labelRadius = radius - 55;
                const lx = radius + labelRadius * Math.cos(rad);
                const ly = radius + labelRadius * Math.sin(rad) + 3;
                const isPassed = angle >= deg;

                return (
                  <text
                    key={deg}
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-chakra text-[10px] font-bold tracking-tight select-none"
                    fill={isPassed ? activeColor : '#475569'}
                    opacity={isPassed ? 0.95 : 0.6}
                  >
                    {displayAngle}°
                  </text>
                );
              })}
            </svg>

            {/* Inner Machined Rotating Rotor Face */}
            <div
              className="relative w-[190px] h-[190px] rounded-full knob-radial-mesh border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.85)] flex items-center justify-center transition-transform duration-75"
              style={{
                transform: `rotate(${angle}deg)`,
              }}
            >
              {/* Radial Brushed Line / Specular Horizon */}
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.06)_90deg,transparent_180deg,rgba(255,255,255,0.06)_270deg,transparent_360deg)] pointer-events-none" />

              {/* Tactile Edge Grip Ridges */}
              <div className="absolute inset-1 rounded-full border border-white/5 border-dashed pointer-events-none" />

              {/* Physical Indicator Needle Pointer (Top of rotor pointing outwards) */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                <div
                  className="w-2.5 h-7 rounded-sm shadow-lg transition-colors"
                  style={{
                    backgroundColor: activeColor,
                    boxShadow: `0 0 14px ${activeColor}, 0 2px 6px rgba(0,0,0,0.8)`,
                  }}
                />
                <div className="w-1.5 h-3 bg-white/90 rounded-full -mt-2" />
              </div>
            </div>

            {/* Central Static Digital Core (HUD Readout) */}
            <div className="absolute w-[140px] h-[140px] rounded-full bg-[#0a0d14]/95 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center p-2 shadow-inner pointer-events-none z-10">
              
              {/* Icon & Mode */}
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] tracking-wider uppercase font-semibold">
                {isVolume ? (
                  <Volume2 className={`w-3.5 h-3.5 ${activeBg}`} />
                ) : (
                  <Sun className={`w-3.5 h-3.5 ${activeBg}`} />
                )}
                <span>{isVolume ? 'Volume' : 'Brightness'}</span>
              </div>

              {/* Primary Angular Degree Readout */}
              <div className="flex items-baseline gap-0.5 mt-0.5">
                <span className="font-chakra text-3xl font-bold text-white tracking-tighter tabular-nums drop-shadow-md">
                  {Math.round(angle)}
                </span>
                <span className={`font-chakra text-lg font-bold ${activeBg}`}>
                  °
                </span>
              </div>

              {/* Secondary Value (Percentage / Metric) */}
              <div className="flex items-center gap-2 text-[11px] font-mono-code text-slate-300 mt-0.5">
                <span className="font-semibold text-slate-200">{percentage}%</span>
                <span className="text-slate-600">·</span>
                {isVolume ? (
                  <span className={angle === 0 ? 'text-rose-400 font-bold' : 'text-cyan-400'}>
                    {angle === 0 ? 'MUTED' : `${(-60 + (angle / 360) * 60).toFixed(1)} dB`}
                  </span>
                ) : (
                  <span className="text-amber-400">
                    {Math.round(10 + (angle / 360) * 1190)} Nits
                  </span>
                )}
              </div>

              {/* Live Gesture Action Status Flag */}
              <div className="mt-1 flex items-center gap-1">
                {isCoolingDown ? (
                  <div className="flex items-center gap-1 text-[9px] font-mono-code font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span>LOCK: {(cooldownRemainingMs / 1000).toFixed(1)}s</span>
                  </div>
                ) : isWaving ? (
                  <div className="flex items-center gap-1 text-[9px] font-mono-code font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{waveDirection === 'right' ? 'WAVE RIGHT +' : 'WAVE LEFT -'}</span>
                  </div>
                ) : isDrifting ? (
                  <div className="flex items-center gap-1 text-[9px] font-mono-code font-bold uppercase tracking-wider text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-500/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                    <span>DRIFTING...</span>
                  </div>
                ) : isGrabbing ? (
                  <div className="flex items-center gap-1 text-[9px] font-mono-code font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>
                      {gestureDirection === 'cw'
                        ? 'ROTATING +'
                        : gestureDirection === 'ccw'
                        ? 'ROTATING -'
                        : 'GRIP LOCKED'}
                    </span>
                  </div>
                ) : (
                  <div className="text-[9px] font-mono-code text-slate-500 tracking-wider uppercase">
                    Ready to Wave
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Quick Radial Control Preset Buttons & Micro-Nudge */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
        <div className="flex items-center gap-1 bg-[#131722] border border-white/10 rounded-lg p-1">
          <button
            onClick={() => {
              let next = (angle - 15) % 360;
              if (next < 0) next += 360;
              onAngleChange(Math.round(next));
            }}
            title="Step -15°"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <span className="text-slate-500 text-[10px] font-mono-code px-1">PRESETS</span>

          <button
            onClick={() => onAngleChange(0)}
            className={`px-2 py-1 font-mono-code rounded transition-colors ${
              angle === 0 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            0°
          </button>
          <button
            onClick={() => onAngleChange(90)}
            className={`px-2 py-1 font-mono-code rounded transition-colors ${
              angle === 90 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            90°
          </button>
          <button
            onClick={() => onAngleChange(180)}
            className={`px-2 py-1 font-mono-code rounded transition-colors ${
              angle === 180 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            180°
          </button>
          <button
            onClick={() => onAngleChange(270)}
            className={`px-2 py-1 font-mono-code rounded transition-colors ${
              angle === 270 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            270°
          </button>
          <button
            onClick={() => onAngleChange(360)}
            className={`px-2 py-1 font-mono-code rounded transition-colors ${
              angle === 360 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            360°
          </button>

          <button
            onClick={() => {
              let next = (angle + 15) % 360;
              if (next < 0) next += 360;
              onAngleChange(Math.round(next));
            }}
            title="Step +15°"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
        <span>Click & drag dial</span>
        <span aria-hidden="true">·</span>
        <span>Mouse scroll</span>
        <span aria-hidden="true">·</span>
        <span>Arrow keys</span>
        <span aria-hidden="true">·</span>
        <span className="text-cyan-400 font-medium">Or Grab with Hand Camera</span>
      </p>
    </div>
  );
};
