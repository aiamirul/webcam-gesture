import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Square, Music, Activity } from 'lucide-react';
import { soundEngine } from '../services/soundEffects';
import type { VolumeState } from '../types';

interface VolumeDashboardProps {
  volumeState: VolumeState;
  onUpdateState: (partial: Partial<VolumeState>) => void;
}

export const VolumeDashboard: React.FC<VolumeDashboardProps> = ({
  volumeState,
  onUpdateState,
}) => {
  const [isPlaying, setIsPlaying] = useState(soundEngine.getIsPlaying());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync volume to audio engine
  useEffect(() => {
    const norm = volumeState.angle / 360;
    soundEngine.setVolume(norm, volumeState.muted);
  }, [volumeState.angle, volumeState.muted]);

  const handleTogglePlay = () => {
    const playing = soundEngine.toggleMusic(volumeState.soundPreset);
    setIsPlaying(playing);
    onUpdateState({ isPlaying: playing });
  };

  const handleSelectPreset = (preset: VolumeState['soundPreset']) => {
    soundEngine.setPreset(preset);
    onUpdateState({ soundPreset: preset });
    if (!isPlaying) {
      const playing = soundEngine.toggleMusic(preset);
      setIsPlaying(playing);
      onUpdateState({ isPlaying: playing });
    }
  };

  // Real-time audio spectrum visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(32);

    const render = () => {
      soundEngine.getFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / 32) - 1.5;
      const effectiveVol = volumeState.muted ? 0 : volumeState.angle / 360;

      for (let i = 0; i < 32; i++) {
        let val = (dataArray[i] / 255) * effectiveVol;
        // If not playing, draw gentle idle floor
        if (!isPlaying && !volumeState.muted) {
          val = 0.04 * (effectiveVol);
        }
        const barHeight = Math.max(3, val * canvas.height * 0.9);
        const x = i * (barWidth + 1.5);
        const y = canvas.height - barHeight;

        const hue = 180 + (i / 32) * 40; // Cyan to bright aqua
        ctx.fillStyle = volumeState.muted ? '#475569' : `hsl(${hue}, 90%, 55%)`;
        ctx.shadowColor = volumeState.muted ? 'transparent' : 'rgba(6, 182, 212, 0.5)';
        ctx.shadowBlur = 6;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, volumeState.angle, volumeState.muted]);

  const volumePct = Math.round((volumeState.angle / 360) * 100);
  const dbVal = volumeState.angle === 0 ? '-∞' : (-60 + (volumeState.angle / 360) * 60).toFixed(1);

  return (
    <div className="flex flex-col gap-4 bg-[#11151f] border border-white/10 rounded-2xl p-5 shadow-xl">
      {/* Title & Status */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            {volumeState.muted || volumeState.angle === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="font-chakra text-sm font-bold text-white uppercase tracking-wider">
              Digital Master Audio
            </h3>
            <p className="text-[11px] text-slate-400 font-mono-code">
              Rotary Attenuator · 32-bit Floating DSP
            </p>
          </div>
        </div>

        <button
          onClick={() => onUpdateState({ muted: !volumeState.muted })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono-code transition-colors cursor-pointer border ${
            volumeState.muted
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
        >
          {volumeState.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{volumeState.muted ? 'MUTED' : 'MUTE'}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-mono-code uppercase">Level</div>
          <div className="font-chakra text-2xl font-bold text-white mt-1">
            {volumeState.muted ? 0 : volumePct}
            <span className="text-cyan-400 text-sm ml-0.5">%</span>
          </div>
        </div>

        <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-mono-code uppercase">Gain (dB)</div>
          <div className="font-chakra text-2xl font-bold text-cyan-300 mt-1">
            {volumeState.muted ? '-∞' : dbVal}
            <span className="text-slate-400 text-xs ml-0.5 font-normal">dB</span>
          </div>
        </div>

        <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-mono-code uppercase">Angle</div>
          <div className="font-chakra text-2xl font-bold text-slate-200 mt-1">
            {Math.round(volumeState.angle)}
            <span className="text-cyan-400 text-sm ml-0.5">°</span>
          </div>
        </div>
      </div>

      {/* Real-time Spectrum Analyser */}
      <div className="bg-[#0b0e15] border border-white/10 rounded-xl p-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono-code mb-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Stereo FFT Analyser</span>
          </div>
          <span className="text-[10px] text-slate-500">20Hz — 20kHz</span>
        </div>
        <canvas
          ref={canvasRef}
          width={280}
          height={64}
          className="w-full h-16 rounded bg-[#090b10]"
        />
      </div>

      {/* Interactive Sound Demo Audition Engine */}
      <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-chakra">
            <Music className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">Audition Audio Loop</span>
          </div>

          <button
            onClick={handleTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-chakra font-bold uppercase transition-all cursor-pointer ${
              isPlaying
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md shadow-cyan-500/20'
            }`}
          >
            {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            <span>{isPlaying ? 'Stop' : 'Play Beat'}</span>
          </button>
        </div>

        {/* Preset Selector */}
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'synthwave', label: '80s Synthwave' },
              { id: 'ambient_lofi', label: 'Chill Lo-Fi' },
              { id: 'techno_pulse', label: 'Techno Pulse' },
              { id: 'reference_tone', label: '440Hz Test Sine' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPreset(p.id)}
              className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-mono-code transition-colors border ${
                volumeState.soundPreset === p.id
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-transparent text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
