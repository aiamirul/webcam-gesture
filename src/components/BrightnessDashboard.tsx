import React from 'react';
import { Sun, Monitor, Sparkles, Layers, Sliders } from 'lucide-react';
import type { BrightnessState } from '../types';

interface BrightnessDashboardProps {
  brightnessState: BrightnessState;
  onUpdateState: (partial: Partial<BrightnessState>) => void;
}

export const BrightnessDashboard: React.FC<BrightnessDashboardProps> = ({
  brightnessState,
  onUpdateState,
}) => {
  const norm = brightnessState.angle / 360;
  const pct = Math.round(norm * 100);
  const nits = Math.round(10 + norm * 1190);
  const lux = Math.round(20 + norm * 2480);

  // Dynamic filter values
  const cssBrightness = (0.2 + norm * 1.6).toFixed(2);
  const cssContrast = (0.85 + norm * 0.35).toFixed(2);
  const glowOpacity = (norm * 0.7).toFixed(2);

  const scenes = [
    {
      id: 'cyber_neon',
      name: 'Cyberpunk Neon',
      desc: 'High contrast neon skyline',
      bgGrad: 'from-fuchsia-900 via-indigo-950 to-slate-950',
      tag: 'OLED Test',
    },
    {
      id: 'matrix_terminal',
      name: 'Matrix Terminal',
      desc: 'Monochrome code buffer',
      bgGrad: 'from-emerald-950 via-slate-950 to-black',
      tag: 'Text Readability',
    },
    {
      id: 'studio_portrait',
      name: 'Studio HDR Portrait',
      desc: 'Accurate skin tones & shadow detail',
      bgGrad: 'from-amber-950 via-stone-900 to-black',
      tag: 'Color Grading',
    },
    {
      id: 'solar_vista',
      name: 'Solar Peak Vista',
      desc: 'Daylight dynamic range highlight',
      bgGrad: 'from-orange-900 via-amber-950 to-slate-950',
      tag: '1200 Nits Peak',
    },
  ] as const;

  const currentScene = scenes.find((s) => s.id === brightnessState.scene) || scenes[0];

  return (
    <div className="flex flex-col gap-4 bg-[#11151f] border border-white/10 rounded-2xl p-5 shadow-xl">
      {/* Title & Status */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-chakra text-sm font-bold text-white uppercase tracking-wider">
              Display Luminance Engine
            </h3>
            <p className="text-[11px] text-slate-400 font-mono-code">
              Calibrated HDR · D65 White Point
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono-code text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
          {norm > 0.8 ? 'PEAK HDR' : norm > 0.4 ? 'STANDARD DCI-P3' : 'LOW LIGHT / ECO'}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-mono-code uppercase">Brightness</div>
          <div className="font-chakra text-2xl font-bold text-white mt-1">
            {pct}
            <span className="text-amber-400 text-sm ml-0.5">%</span>
          </div>
        </div>

        <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-mono-code uppercase">Peak Luminance</div>
          <div className="font-chakra text-2xl font-bold text-amber-300 mt-1">
            {nits}
            <span className="text-slate-400 text-xs ml-0.5 font-normal">cd/m²</span>
          </div>
        </div>

        <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-mono-code uppercase">Ambient Lux</div>
          <div className="font-chakra text-2xl font-bold text-slate-200 mt-1">
            {lux}
            <span className="text-amber-400 text-sm ml-0.5">lx</span>
          </div>
        </div>
      </div>

      {/* Live Studio Monitor Screen Preview */}
      <div className="relative rounded-xl border border-white/10 bg-[#07090e] p-3 flex flex-col items-center overflow-hidden">
        {/* Ambient Backlight Bloom behind monitor */}
        <div
          className="absolute -inset-4 rounded-3xl pointer-events-none transition-all duration-150 blur-2xl"
          style={{
            background: `radial-gradient(circle, rgba(245, 158, 11, ${glowOpacity}) 0%, transparent 70%)`,
          }}
        />

        {/* Monitor Casing */}
        <div className="relative w-full rounded-lg bg-[#0f131c] border-2 border-[#202738] p-2 shadow-2xl">
          {/* Top monitor bezel tag */}
          <div className="flex items-center justify-between text-[10px] font-mono-code text-slate-500 mb-1.5 px-1">
            <span className="flex items-center gap-1 text-slate-400">
              <Monitor className="w-3 h-3 text-amber-400" />
              <span>REFERENCE CALIBRATED DISPLAY</span>
            </span>
            <span className="text-amber-400 font-bold">{nits} NITS</span>
          </div>

          {/* Active Screen Area with Dynamic CSS Filter */}
          <div
            className={`relative w-full h-36 rounded overflow-hidden bg-gradient-to-br ${currentScene.bgGrad} transition-all duration-75 flex flex-col justify-between p-3.5 border border-white/10`}
            style={{
              filter: `brightness(${cssBrightness}) contrast(${cssContrast})`,
            }}
          >
            {/* Screen Content Graphics */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono-code text-white">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{currentScene.name}</span>
              </div>
              <span className="text-[10px] font-mono-code text-white/80 bg-white/10 px-1.5 py-0.5 rounded">
                {currentScene.tag}
              </span>
            </div>

            {/* Graphic Artwork Simulation */}
            {brightnessState.scene === 'cyber_neon' && (
              <div className="my-auto flex items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-400/80 shadow-[0_0_20px_#06b6d4]" />
                <div className="w-12 h-12 rounded-lg bg-fuchsia-500/80 rotate-12 shadow-[0_0_20px_#d946ef]" />
                <div className="w-7 h-7 rounded-full bg-amber-400/80 shadow-[0_0_20px_#f59e0b]" />
              </div>
            )}

            {brightnessState.scene === 'matrix_terminal' && (
              <div className="font-mono-code text-[11px] text-emerald-300 leading-tight">
                <div>&gt; rotary_dial.read_angle() -&gt; {Math.round(brightnessState.angle)} deg</div>
                <div>&gt; pwm_backlight_level: {pct}% OK</div>
                <div className="text-emerald-500">&gt; dsp_optical_tracking: active</div>
              </div>
            )}

            {brightnessState.scene === 'studio_portrait' && (
              <div className="my-auto text-center font-chakra text-white text-xs tracking-widest uppercase">
                Dynamic Range Test Chart · Gamma 2.2
              </div>
            )}

            {brightnessState.scene === 'solar_vista' && (
              <div className="my-auto flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-t from-orange-400 to-amber-200 shadow-[0_0_35px_#f59e0b]" />
              </div>
            )}

            {/* Bottom Screen Bar */}
            <div className="flex items-center justify-between text-[10px] font-mono-code text-white/80">
              <span>Backlight Duty: {pct}%</span>
              <span>Gamma: 2.22</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scene Presets Selector */}
      <div className="bg-[#161c2a] border border-white/5 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-chakra mb-2">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold">Test Scene Presets</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {scenes.map((s) => (
            <button
              key={s.id}
              onClick={() => onUpdateState({ scene: s.id as BrightnessState['scene'] })}
              className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-mono-code transition-colors border ${
                brightnessState.scene === s.id
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-transparent text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <div className="font-medium text-white text-[11px]">{s.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{s.tag}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
