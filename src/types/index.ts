export type ControllerMode = 'volume' | 'brightness';

export type GestureControlMode = 'palm_drift' | 'pinch_twist';

export type ProcessingResolution = '120p' | '240p' | '480p';

export type GestureAction =
  | 'idle'
  | 'searching'
  | 'ready'
  | 'waving_left'
  | 'waving_right'
  | 'cooldown'
  | 'drifting'
  | 'grabbed'
  | 'rotating_cw'
  | 'rotating_ccw';

export interface GestureDetectionState {
  handDetected: boolean;
  isGrabbing: boolean;
  gestureAction: GestureAction;
  confidence: number;
  pinchDistance: number; // 0 to 1 normalized
  pinchThreshold: number; // typically 0.35 - 0.45
  gripCenter: { x: number; y: number } | null; // normalized 0..1 coordinates in video frame
  wristPosition: { x: number; y: number } | null;
  palmPosition: { x: number; y: number } | null;
  palmBox: { xMin: number; yMin: number; width: number; height: number } | null; // normalized 0..1 object detection box
  rawAngle: number; // degrees
  angleDelta: number; // degrees change in current step
  direction: 'cw' | 'ccw' | 'static';
  handedness: 'Right' | 'Left' | 'Unknown';

  // Palm Wave & Physics Drift mechanics
  controlMode: GestureControlMode;
  palmVelocityX: number; // velocity in normalized units/sec
  palmSpeed: number; // magnitude
  isWaving: boolean;
  waveDirection: 'left' | 'right' | 'none';
  angularVelocity: number; // current physics drift speed in deg/frame
  isDrifting: boolean;
  totalWaveDriftDeg: number; // projected or accumulated degrees for current wave (45° to 180°+)

  // 2-second Cooldown & Lock cycle
  isCoolingDown: boolean;
  cooldownRemainingMs: number; // in milliseconds (e.g. 2000 down to 0)
  cooldownDurationMs: number; // default 2000ms
}

export interface TrackingTelemetry {
  fps: number;
  latencyMs: number;
  backend: string;
  isModelReady: boolean;
  statusMessage: string;
  hasWebcamPermission: boolean | null; // null = pending/prompt
}

export interface VolumeState {
  angle: number; // 0 to 360 degrees
  percentage: number; // 0 to 100%
  db: number; // -60 to 0 dB
  muted: boolean;
  isPlaying: boolean;
  soundPreset: 'synthwave' | 'ambient_lofi' | 'techno_pulse' | 'reference_tone';
}

export interface BrightnessState {
  angle: number; // 0 to 360 degrees
  percentage: number; // 0 to 100%
  nits: number; // 10 to 1200 nits
  colorTempK: number; // 3200K to 6500K
  scene: 'cyber_neon' | 'matrix_terminal' | 'studio_portrait' | 'solar_vista';
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  name?: string;
}
