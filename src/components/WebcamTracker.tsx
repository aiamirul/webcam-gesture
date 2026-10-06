import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MoveHorizontal,
  Wind,
  Hand,
  Compass,
  Timer,
  Gauge,
  Box,
  Zap,
} from 'lucide-react';
import {
  handDetectorService,
  HAND_CONNECTIONS,
} from '../services/handDetector';
import { soundEngine } from '../services/soundEffects';
import type {
  GestureControlMode,
  GestureDetectionState,
  ProcessingResolution,
  TrackingTelemetry,
  LandmarkPoint,
} from '../types';

interface WebcamTrackerProps {
  onAngleDelta: (delta: number, isGrabbing: boolean) => void;
  onGestureStateChange: (state: GestureDetectionState) => void;
  currentKnobAngle: number;
  onOpenGuide: () => void;
}

export const WebcamTracker: React.FC<WebcamTrackerProps> = ({
  onAngleDelta,
  onGestureStateChange,
  currentKnobAngle,
  onOpenGuide,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const procCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [controlMode, setControlMode] = useState<GestureControlMode>('palm_drift');
  // 120p is default for ultra-lightweight, 60+ FPS, zero-latency processing
  const [processingResolution, setProcessingResolution] = useState<ProcessingResolution>('120p');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [palmSensitivity, setPalmSensitivity] = useState(0.30); // Lower = more sensitive detection
  const [friction, setFriction] = useState(0.925);
  const [pinchThreshold, setPinchThreshold] = useState(0.38);

  // Initialize offscreen canvas once
  useEffect(() => {
    if (!procCanvasRef.current) {
      procCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Telemetry state
  const [telemetry, setTelemetry] = useState<TrackingTelemetry>({
    fps: 0,
    latencyMs: 0,
    backend: 'WebGL',
    isModelReady: false,
    statusMessage: 'Ready to connect camera',
    hasWebcamPermission: null,
  });

  const [liveGesture, setLiveGesture] = useState<GestureDetectionState>({
    handDetected: false,
    isGrabbing: false,
    gestureAction: 'searching',
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

  const [isSimulating, setIsSimulating] = useState(false);
  const simulationTimerRef = useRef<number | null>(null);

  // Audio triggering refs
  const wasGrabbingRef = useRef(false);
  const wasWavingRef = useRef(false);
  const lastSoundTickAngleRef = useRef(currentKnobAngle);

  // Resolution dimensions map: 120p (160x120), 240p (320x240), 480p (640x480)
  const resolutionDimensions = {
    '120p': { width: 160, height: 120 },
    '240p': { width: 320, height: 240 },
    '480p': { width: 640, height: 480 },
  };

  // Start Camera Stream
  const startCamera = async () => {
    try {
      setTelemetry((prev) => ({
        ...prev,
        statusMessage: 'Accessing webcam stream...',
      }));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 60, min: 30 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setTelemetry((prev) => ({
          ...prev,
          hasWebcamPermission: true,
          statusMessage: 'Loading TensorFlow.js detector...',
        }));

        // Initialize detector
        const initRes = await handDetectorService.initialize();
        if (initRes.success) {
          setTelemetry((prev) => ({
            ...prev,
            isModelReady: true,
            backend: initRes.backend,
            statusMessage: 'Palm tracker active',
          }));
        } else {
          setTelemetry((prev) => ({
            ...prev,
            statusMessage: `AI Model fallback: ${initRes.error || 'Failed to load model'}`,
          }));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Camera access error:', msg);
      setTelemetry((prev) => ({
        ...prev,
        hasWebcamPermission: false,
        statusMessage: 'Camera permission denied or camera unavailable',
      }));
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsCameraActive(false);
    setTelemetry((prev) => ({
      ...prev,
      isModelReady: false,
      statusMessage: 'Camera stopped',
    }));
    setLiveGesture((prev) => ({
      ...prev,
      handDetected: false,
      isGrabbing: false,
      isDrifting: false,
      gestureAction: 'idle',
      isCoolingDown: false,
      cooldownRemainingMs: 0,
      palmBox: null,
    }));
  };

  // Sync mode and tuning parameters
  useEffect(() => {
    handDetectorService.controlMode = controlMode;
  }, [controlMode]);

  useEffect(() => {
    handDetectorService.sensitivity = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    handDetectorService.palmSensitivity = palmSensitivity;
  }, [palmSensitivity]);

  useEffect(() => {
    handDetectorService.friction = friction;
  }, [friction]);

  useEffect(() => {
    handDetectorService.pinchThreshold = pinchThreshold;
  }, [pinchThreshold]);

  // Main Animation & Detection Loop with 120p / Downsampling
  const runDetectionLoop = useCallback(() => {
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const loop = async () => {
      if (!isCameraActive || !videoRef.current || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      const latency = Math.round(now - lastTime);
      lastTime = now;
      frameCount++;

      if (now - fpsTimer >= 1000) {
        setTelemetry((prev) => ({
          ...prev,
          fps: frameCount,
          latencyMs: latency,
        }));
        frameCount = 0;
        fpsTimer = now;
      }

      // 1. Step continuous physics drift (runs on EVERY frame!)
      const physics = handDetectorService.stepPhysics();
      if (physics.isDrifting && Math.abs(physics.deltaAngle) > 0.04) {
        onAngleDelta(physics.deltaAngle, true);

        // Audible mechanical detent tick
        if (Math.abs(currentKnobAngle - lastSoundTickAngleRef.current) >= 3.5) {
          soundEngine.playKnobTick(currentKnobAngle);
          lastSoundTickAngleRef.current = currentKnobAngle;
        }
      }

      // 2. Downscale to 120p / selected resolution for ultra-fast inference
      const targetDim = resolutionDimensions[processingResolution];
      let procSource: HTMLVideoElement | HTMLCanvasElement = videoRef.current;

      if (procCanvasRef.current) {
        const pCanvas = procCanvasRef.current;
        pCanvas.width = targetDim.width;
        pCanvas.height = targetDim.height;
        const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
        if (pCtx) {
          pCtx.drawImage(videoRef.current, 0, 0, targetDim.width, targetDim.height);
          procSource = pCanvas;
        }
      }

      // 3. Estimate Palm Object Detection Box on lightweight frame
      const { gesture, rawLandmarks } = await handDetectorService.estimateHand(
        procSource,
        isMirrored
      );

      setLiveGesture(gesture);
      onGestureStateChange(gesture);

      // 4. Audio Cues for Wave / Pinch
      if (controlMode === 'palm_drift') {
        if (gesture.isWaving && !wasWavingRef.current) {
          soundEngine.playWaveWhoosh(gesture.palmSpeed);
        }
        wasWavingRef.current = gesture.isWaving;
      } else {
        if (gesture.isGrabbing && !wasGrabbingRef.current) {
          soundEngine.playGrabSound();
        } else if (!gesture.isGrabbing && wasGrabbingRef.current) {
          soundEngine.playReleaseSound();
        }
        wasGrabbingRef.current = gesture.isGrabbing;

        if (gesture.isGrabbing && Math.abs(gesture.angleDelta) > 0.1) {
          const effectiveDelta = isMirrored ? -gesture.angleDelta : gesture.angleDelta;
          onAngleDelta(effectiveDelta, true);

          if (Math.abs(currentKnobAngle - lastSoundTickAngleRef.current) >= 4) {
            soundEngine.playKnobTick(currentKnobAngle);
            lastSoundTickAngleRef.current = currentKnobAngle;
          }
        }
      }

      // 5. Draw Clean Object Detection Box on Canvas
      if (canvasRef.current && videoRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 480;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          drawOverlay(
            ctx,
            rawLandmarks,
            canvas.width,
            canvas.height,
            targetDim.width,
            targetDim.height,
            gesture
          );
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [
    isCameraActive,
    isMirrored,
    controlMode,
    processingResolution,
    currentKnobAngle,
    onAngleDelta,
    onGestureStateChange,
  ]);

  useEffect(() => {
    if (isCameraActive) {
      runDetectionLoop();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, runDetectionLoop]);

  // Clean Object Detection Box & Cooldown HUD Drawing (No messy 21-joint skeleton in palm mode!)
  const drawOverlay = (
    ctx: CanvasRenderingContext2D,
    landmarks: LandmarkPoint[] | null,
    dispWidth: number,
    dispHeight: number,
    procWidth: number,
    procHeight: number,
    gesture: GestureDetectionState
  ) => {
    ctx.save();

    // Scale factors
    const scaleX = dispWidth / procWidth;
    const scaleY = dispHeight / procHeight;

    const getPoint = (pt: LandmarkPoint) => {
      const px = pt.x * scaleX;
      const py = pt.y * scaleY;
      const x = isMirrored ? dispWidth - px : px;
      return { x, y: py };
    };

    // 1. PINCH TWIST MODE ONLY: Draw skeleton if user is in pinch mode
    if (controlMode === 'pinch_twist' && landmarks) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = gesture.isGrabbing ? 'rgba(52, 211, 153, 0.7)' : 'rgba(34, 211, 238, 0.4)';
      HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = getPoint(landmarks[i]);
        const p2 = getPoint(landmarks[j]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      const thumb = getPoint(landmarks[4]);
      const index = getPoint(landmarks[8]);
      const midX = (thumb.x + index.x) / 2;
      const midY = (thumb.y + index.y) / 2;

      ctx.beginPath();
      ctx.arc(midX, midY, 18, 0, Math.PI * 2);
      ctx.strokeStyle = gesture.isGrabbing ? '#34d399' : '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 2. PALM MODE: CLEAN OBJECT DETECTION BOX (Nothing too fancy, just the palm box moving left to right)
    if (controlMode === 'palm_drift') {
      // Screen Left/Right Guides
      ctx.font = '10px Chakra Petch, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.textAlign = 'left';
      ctx.fillText('◄ LEFT [CCW -]', 16, dispHeight / 2);
      ctx.textAlign = 'right';
      ctx.fillText('[CW +] RIGHT ►', dispWidth - 16, dispHeight / 2);

      if (gesture.palmBox) {
        const b = gesture.palmBox;
        const rawBoxX = b.xMin * dispWidth;
        const boxW = Math.max(70, b.width * dispWidth);
        const boxH = Math.max(70, b.height * dispHeight);
        const boxY = b.yMin * dispHeight;
        const boxX = isMirrored ? dispWidth - rawBoxX - boxW : rawBoxX;

        const boxColor = gesture.isCoolingDown
          ? '#f59e0b'
          : gesture.isWaving
          ? '#10b981'
          : '#06b6d4';

        // Semi-transparent box fill & border
        ctx.fillStyle = gesture.isCoolingDown
          ? 'rgba(245, 158, 11, 0.12)'
          : gesture.isWaving
          ? 'rgba(16, 185, 129, 0.16)'
          : 'rgba(6, 182, 212, 0.10)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Corner HUD Brackets
        const cLen = Math.min(18, boxW * 0.25);
        ctx.lineWidth = 3.5;
        // Top-left
        ctx.beginPath(); ctx.moveTo(boxX, boxY + cLen); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cLen, boxY); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(boxX + boxW - cLen, boxY); ctx.lineTo(boxX + boxW, boxY); ctx.lineTo(boxX + boxW, boxY + cLen); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(boxX, boxY + boxH - cLen); ctx.lineTo(boxX, boxY + boxH); ctx.lineTo(boxX + cLen, boxY + boxH); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(boxX + boxW - cLen, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH - cLen); ctx.stroke();

        // Center crosshair
        const cX = boxX + boxW / 2;
        const cY = boxY + boxH / 2;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cX - 10, cY); ctx.lineTo(cX + 10, cY);
        ctx.moveTo(cX, cY - 10); ctx.lineTo(cX, cY + 10);
        ctx.stroke();

        // Top Header Tag
        const xPosPct = Math.round((cX / dispWidth) * 100);
        ctx.font = 'bold 11px Chakra Petch, sans-serif';
        ctx.fillStyle = boxColor;
        ctx.textAlign = 'left';
        ctx.shadowColor = boxColor;
        ctx.shadowBlur = 6;

        if (gesture.isCoolingDown) {
          const remainingSec = (gesture.cooldownRemainingMs / 1000).toFixed(1);
          ctx.fillText(`[ 2s LOCK: ${remainingSec}s ]`, boxX, boxY - 8);
        } else if (gesture.isWaving) {
          const driftDeg = Math.round(gesture.totalWaveDriftDeg || 45);
          ctx.fillText(
            gesture.waveDirection === 'right'
              ? `[ WAVE: LEFT TO RIGHT +${driftDeg}° ]`
              : `[ WAVE: RIGHT TO LEFT -${driftDeg}° ]`,
            boxX,
            boxY - 8
          );
        } else {
          ctx.fillText(`[ PALM DETECTED · SCREEN X: ${xPosPct}% ]`, boxX, boxY - 8);
        }

        // IF COOLING DOWN: Draw 2.0s progress arc around center crosshair
        if (gesture.isCoolingDown) {
          const progress = 1 - gesture.cooldownRemainingMs / gesture.cooldownDurationMs;
          ctx.beginPath();
          ctx.arc(cX, cY, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3.5;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  };

  // AI Simulator with 2-second cooldown wait
  const toggleSimulator = () => {
    if (isSimulating) {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      setIsSimulating(false);
      handDetectorService.angularVelocity = 0;
      setLiveGesture((prev) => ({
        ...prev,
        handDetected: false,
        isWaving: false,
        isDrifting: false,
        isCoolingDown: false,
        cooldownRemainingMs: 0,
        gestureAction: 'idle',
        palmBox: null,
      }));
    } else {
      setIsSimulating(true);
      let step = 0;

      const simPhysicsInterval = window.setInterval(() => {
        if (!isCameraActive) {
          const physics = handDetectorService.stepPhysics();
          if (physics.isDrifting && Math.abs(physics.deltaAngle) > 0.04) {
            onAngleDelta(physics.deltaAngle, true);
            if (Math.abs(currentKnobAngle - lastSoundTickAngleRef.current) >= 3) {
              soundEngine.playKnobTick(currentKnobAngle);
              lastSoundTickAngleRef.current = currentKnobAngle;
            }
          }
        }
      }, 16);

      // Simulator executes: Movement -> 2.0s wait -> Next Movement!
      simulationTimerRef.current = window.setInterval(() => {
        step++;
        const isRightTurn = step % 2 === 1;

        soundEngine.playWaveWhoosh(isRightTurn ? 1.0 : 0.7);
        handDetectorService.simulateWave(isRightTurn ? 2.5 : -1.2);

        setLiveGesture((p) => ({
          ...p,
          handDetected: true,
          isWaving: true,
          waveDirection: isRightTurn ? 'right' : 'left',
          gestureAction: isRightTurn ? 'waving_right' : 'waving_left',
          palmSpeed: isRightTurn ? 2.5 : 1.2,
          totalWaveDriftDeg: isRightTurn ? 180 : 90,
          palmPosition: { x: isRightTurn ? 0.7 : 0.35, y: 0.5 },
          palmBox: {
            xMin: isRightTurn ? 0.6 : 0.25,
            yMin: 0.35,
            width: 0.2,
            height: 0.3,
          },
          isCoolingDown: true,
          cooldownRemainingMs: 2000,
        }));

        let countdown = 2000;
        const tickCountdown = window.setInterval(() => {
          countdown -= 100;
          if (countdown <= 0) {
            clearInterval(tickCountdown);
            setLiveGesture((p) => ({
              ...p,
              isWaving: false,
              isCoolingDown: false,
              cooldownRemainingMs: 0,
              gestureAction: 'ready',
            }));
          } else {
            setLiveGesture((p) => ({
              ...p,
              isWaving: false,
              isCoolingDown: true,
              cooldownRemainingMs: countdown,
              gestureAction: 'cooldown',
            }));
          }
        }, 100);
      }, 2400);

      return () => {
        clearInterval(simPhysicsInterval);
      };
    }
  };

  useEffect(() => {
    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, []);

  const currentSpeedScore = Math.min(
    100,
    Math.round((Math.abs(liveGesture.angularVelocity) / 14) * 100)
  );

  return (
    <div className="flex flex-col rounded-2xl bg-[#11151f] border border-white/10 overflow-hidden shadow-2xl">
      {/* Header bar */}
      <div className="px-4 py-3 bg-[#161b27] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isCameraActive
                ? liveGesture.isCoolingDown
                  ? 'bg-amber-400 animate-pulse'
                  : liveGesture.isWaving
                  ? 'bg-emerald-400 animate-ping'
                  : liveGesture.isDrifting
                  ? 'bg-sky-400'
                  : 'bg-cyan-400'
                : isSimulating
                ? 'bg-amber-400 animate-pulse'
                : 'bg-slate-600'
            }`}
          />
          <h2 className="font-chakra text-sm font-semibold text-white tracking-wide uppercase">
            AI Palm Box Tracker
          </h2>
          <span className="text-slate-500 text-xs">·</span>
          <span className="text-cyan-400 text-xs font-mono-code font-bold">
            {processingResolution} Fast
          </span>
        </div>

        {/* Gesture Mode & Guide Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0d1017] p-0.5 rounded-lg border border-white/10 text-xs">
            <button
              onClick={() => setControlMode('palm_drift')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-chakra font-medium transition-colors cursor-pointer ${
                controlMode === 'palm_drift'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-cyan-400" />
              <span>Palm Box Drift</span>
            </button>

            <button
              onClick={() => setControlMode('pinch_twist')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-chakra font-medium transition-colors cursor-pointer ${
                controlMode === 'pinch_twist'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Hand className="w-3.5 h-3.5 text-amber-400" />
              <span>Pinch & Twist</span>
            </button>
          </div>

          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-cyan-300 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guide</span>
          </button>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div className="relative w-full aspect-4/3 bg-[#080a0f] flex items-center justify-center overflow-hidden">
        {/* Actual Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-300 ${
            isMirrored ? 'scale-x-[-1]' : 'scale-x-100'
          } ${!isCameraActive ? 'hidden' : 'block'}`}
        />

        {/* Clean Object Detection Overlay */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none ${
            !isCameraActive ? 'hidden' : 'block'
          }`}
        />

        {/* Video Inactive Placeholder */}
        {!isCameraActive && (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <Camera className="w-8 h-8" />
            </div>

            <h3 className="font-chakra text-base font-bold text-white mb-1">
              Webcam Feed Offline
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Enable your webcam. Moving your palm across the screen (left-to-right or right-to-left) rotates the dial and glides 45° to 180° with a 2-second lock.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-xs font-chakra tracking-wide uppercase transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Initialize Camera</span>
              </button>

              <button
                onClick={toggleSimulator}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-mono-code transition-colors border ${
                  isSimulating
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSimulating ? 'Stop Simulator' : 'Test Palm Box Drift'}</span>
              </button>
            </div>

            {telemetry.hasWebcamPermission === false && (
              <div className="mt-4 flex items-center gap-2 text-[11px] text-rose-400 bg-rose-950/30 border border-rose-500/30 p-2 rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Permission required. Check browser camera settings or use manual dial.</span>
              </div>
            )}
          </div>
        )}

        {/* In-Video Holographic HUD Indicators */}
        {isCameraActive && (
          <>
            {/* Top Status Banner */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded backdrop-blur-md border text-xs font-mono-code ${
                  liveGesture.isCoolingDown
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                    : liveGesture.isWaving
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                    : liveGesture.isDrifting
                    ? 'bg-sky-950/80 border-sky-500/50 text-sky-300'
                    : liveGesture.handDetected
                    ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                    : 'bg-black/70 border-white/10 text-slate-400'
                }`}
              >
                {liveGesture.isCoolingDown ? (
                  <>
                    <Timer className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span className="font-bold">
                      WAITING 2.0s FOR NEXT WAVE [ {(liveGesture.cooldownRemainingMs / 1000).toFixed(1)}s ]
                    </span>
                  </>
                ) : liveGesture.isWaving ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold">
                      {liveGesture.waveDirection === 'right'
                        ? `PALM LEFT-TO-RIGHT >>> [+${Math.round(liveGesture.totalWaveDriftDeg)}°]`
                        : `<<< PALM RIGHT-TO-LEFT [ -${Math.round(liveGesture.totalWaveDriftDeg)}° ]`}
                    </span>
                  </>
                ) : liveGesture.isDrifting ? (
                  <>
                    <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                    <span className="font-bold">
                      COASTING · {Math.abs(liveGesture.angularVelocity * 10).toFixed(0)}°/SEC
                    </span>
                  </>
                ) : liveGesture.handDetected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>PALM BOX LOCKED · MOVE LEFT OR RIGHT</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                    <span>LOOKING FOR PALM IN VIEW</span>
                  </>
                )}
              </div>

              {/* Handedness, Resolution & FPS */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono-code bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-white/10 text-slate-400">
                <span className="text-cyan-300 font-bold">{processingResolution}</span>
                <span>·</span>
                <span className="text-white font-bold">{telemetry.fps} FPS</span>
                <span>·</span>
                <span>{telemetry.latencyMs}ms</span>
              </div>
            </div>

            {/* Bottom Physics Momentum & 2s Wait Bar */}
            <div className="absolute bottom-3 inset-x-3 pointer-events-none">
              <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-lg p-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono-code mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    {liveGesture.isCoolingDown ? (
                      <Timer className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Wind className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>
                      {liveGesture.isCoolingDown
                        ? `Lock Active (${(liveGesture.cooldownRemainingMs / 1000).toFixed(1)}s)`
                        : 'Palm Screen Drift (45° — 180°)'}
                    </span>
                  </span>
                  <span
                    className={
                      liveGesture.isCoolingDown
                        ? 'text-amber-400 font-bold'
                        : liveGesture.isWaving
                        ? 'text-emerald-400 font-bold'
                        : liveGesture.isDrifting
                        ? 'text-sky-300 font-bold'
                        : 'text-slate-400'
                    }
                  >
                    {liveGesture.isCoolingDown
                      ? `NEXT IN: ${(liveGesture.cooldownRemainingMs / 1000).toFixed(1)}s`
                      : liveGesture.isWaving
                      ? `IMPULSE: ~${Math.round(liveGesture.totalWaveDriftDeg)}°`
                      : liveGesture.isDrifting
                      ? `COASTING (${currentSpeedScore}%)`
                      : 'PALM ARMED'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden flex items-center">
                  {liveGesture.isCoolingDown ? (
                    <div
                      className="h-full bg-amber-400 shadow-[0_0_12px_#f59e0b] transition-all duration-75"
                      style={{
                        width: `${Math.max(
                          0,
                          (1 - liveGesture.cooldownRemainingMs / liveGesture.cooldownDurationMs) * 100
                        )}%`,
                      }}
                    />
                  ) : (
                    <>
                      <div
                        className={`h-full transition-all duration-75 ${
                          liveGesture.isWaving
                            ? 'bg-emerald-400 shadow-[0_0_12px_#10b981]'
                            : liveGesture.isDrifting
                            ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]'
                            : 'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, currentSpeedScore))}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10"
                        style={{ left: '25%' }}
                        title="45° drift speed"
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-400/80 z-10"
                        style={{ left: '90%' }}
                        title="180° max drift speed"
                      />
                    </>
                  )}
                </div>

                <div className="flex justify-between text-[9px] font-mono-code text-slate-500 mt-1">
                  {liveGesture.isCoolingDown ? (
                    <>
                      <span className="text-amber-400">Locking out extra twitches...</span>
                      <span className="text-sky-300">Physics drift gliding cleanly</span>
                    </>
                  ) : (
                    <>
                      <span>Gentle (~45°)</span>
                      <span className="text-amber-400/80">Mid (~90°)</span>
                      <span className="text-emerald-400">Fast Wave (~180°)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Control Bar & Calibration Settings */}
      <div className="p-3 bg-[#131722] border-t border-white/10 flex flex-col gap-3">
        {/* Primary toggles & 120p / 240p / 480p Quality Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isCameraActive ? (
            <button
              onClick={stopCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-chakra transition-colors cursor-pointer"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Turn Off Cam</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 text-xs font-chakra transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Enable Camera</span>
            </button>
          )}

          {/* Processing Resolution: 120p (Ultra Turbo), 240p, 480p */}
          <div className="flex items-center gap-1 bg-[#0b0e15] border border-white/10 p-1 rounded-lg text-xs">
            <span className="text-slate-500 text-[10px] font-mono-code px-1 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              <span>SPEED:</span>
            </span>

            {(['120p', '240p', '480p'] as ProcessingResolution[]).map((res) => (
              <button
                key={res}
                onClick={() => setProcessingResolution(res)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono-code transition-colors cursor-pointer ${
                  processingResolution === res
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title={
                  res === '120p'
                    ? '120p: 160x120 ultra-lightweight, <3ms latency, 60+ FPS!'
                    : res === '240p'
                    ? '240p: 320x240 fast balanced'
                    : '480p: 640x480 full frame'
                }
              >
                {res === '120p' ? '120p (Ultra)' : res}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMirrored(!isMirrored)}
              title={isMirrored ? 'Disable Mirror' : 'Enable Mirror'}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                isMirrored
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <MoveHorizontal className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleSimulator}
              title="Test with simulated gesture"
              className={`px-2.5 py-1.5 rounded text-[11px] font-mono-code transition-colors cursor-pointer ${
                isSimulating
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {isSimulating ? 'Sim On' : 'Sim 2s Wave'}
            </button>
          </div>
        </div>

        {/* Sensitivity Sliders: Palm Detection Sensitivity & Wave Impulse */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
          <div>
            <div className="flex justify-between text-slate-400 text-[10px] font-mono-code mb-1">
              <span>PALM DETECTION SENSITIVITY</span>
              <span className="text-cyan-300">
                {palmSensitivity <= 0.25 ? 'High (Easiest)' : palmSensitivity <= 0.45 ? 'Normal' : 'Strict'}
              </span>
            </div>
            <input
              type="range"
              min="0.15"
              max="0.75"
              step="0.05"
              value={palmSensitivity}
              onChange={(e) => setPalmSensitivity(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 text-[10px] font-mono-code mb-1">
              <span>WAVE SENSITIVITY / BOOST</span>
              <span className="text-amber-300">{sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full accent-amber-400 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
