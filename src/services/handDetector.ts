import * as tf from '@tensorflow/tfjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import type { GestureControlMode, GestureDetectionState, LandmarkPoint } from '../types';

interface PositionSample {
  x: number;
  y: number;
  time: number;
}

export class HandDetectorService {
  private detector: handPoseDetection.HandDetector | null = null;
  private isInitializing = false;
  private initError: string | null = null;

  // Active control mode
  public controlMode: GestureControlMode = 'palm_drift';

  // Tuning knobs
  public sensitivity = 1.0;
  public pinchThreshold = 0.38;
  public friction = 0.925; // Physics drift damping per frame (~60fps)
  public palmSensitivity = 0.30; // Palm detection threshold (lower = more sensitive)

  // 2-second Cooldown & Single-Movement Cycle
  public cooldownDurationMs = 2000; // Exact 2.0 seconds cooldown requested
  private cooldownUntil = 0;
  private isArmedForMovement = true;

  // Grabbing state (for pinch_twist mode)
  private lastProcessedAngle: number | null = null;
  private smoothedAngleDelta = 0;
  private isGrabbingState = false;
  private consecutiveGrabFrames = 0;
  private consecutiveReleaseFrames = 0;

  // Palm velocity tracking
  private positionHistory: PositionSample[] = [];
  private smoothedVelocityX = 0;

  // Physics drift state
  public angularVelocity = 0; // Current drift speed (deg / frame)
  public projectedWaveDrift = 0;

  constructor() {
    // Lazy initialized
  }

  public async initialize(): Promise<{ success: boolean; error?: string; backend: string }> {
    if (this.detector) {
      return { success: true, backend: tf.getBackend() };
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return { success: !!this.detector, backend: tf.getBackend(), error: this.initError || undefined };
    }

    this.isInitializing = true;
    this.initError = null;

    try {
      await tf.ready();
      try {
        await tf.setBackend('webgl');
      } catch {
        console.warn('WebGL backend not available, falling back to CPU');
        await tf.setBackend('cpu');
      }

      const model = handPoseDetection.SupportedModels.MediaPipeHands;
      const detectorConfig: handPoseDetection.MediaPipeHandsTfjsModelConfig = {
        runtime: 'tfjs',
        modelType: 'lite',
        maxHands: 1,
      };

      this.detector = await handPoseDetection.createDetector(model, detectorConfig);
      this.isInitializing = false;
      return { success: true, backend: tf.getBackend() };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to initialize Hand Detector:', errMsg);
      this.initError = errMsg;
      this.isInitializing = false;
      return { success: false, error: errMsg, backend: tf.getBackend() };
    }
  }

  public isReady(): boolean {
    return this.detector !== null;
  }

  /**
   * Physics step for inertia drift (called each animation frame)
   * Continues drifting smoothly even during the 2-second cooldown
   */
  public stepPhysics(): { deltaAngle: number; isDrifting: boolean; currentVelocity: number } {
    if (Math.abs(this.angularVelocity) > 0.05) {
      const delta = this.angularVelocity;
      this.angularVelocity *= this.friction;

      if (Math.abs(this.angularVelocity) <= 0.05) {
        this.angularVelocity = 0;
      }

      return {
        deltaAngle: delta,
        isDrifting: true,
        currentVelocity: this.angularVelocity,
      };
    }

    this.angularVelocity = 0;
    return { deltaAngle: 0, isDrifting: false, currentVelocity: 0 };
  }

  /**
   * Trigger the single movement and lock into 2-second cooldown
   * 1 wave goes from 45 degrees up to 180 degrees for fastest swipe
   */
  public triggerMovementAndLock(rawVx: number, isMirrored: boolean): boolean {
    const now = performance.now();
    if (now < this.cooldownUntil || !this.isArmedForMovement) {
      return false; // Still cooling down or not armed
    }

    const effectiveVx = isMirrored ? -rawVx : rawVx;
    const speed = Math.abs(effectiveVx);
    if (speed < 0.28) return false;

    // Map speed (0.3 to 2.8 screens/sec) to 45 deg .. 180 deg
    const clampedSpeed = Math.min(2.8, Math.max(0.35, speed));
    const speedRatio = Math.min(1, (clampedSpeed - 0.35) / 2.3);
    const targetDriftDegrees = (45 + speedRatio * 135) * this.sensitivity;
    this.projectedWaveDrift = targetDriftDegrees;

    // Convert total drift to initial angular velocity V0
    const decayRate = 1 - this.friction;
    const initialVelocity = (effectiveVx > 0 ? 1 : -1) * (targetDriftDegrees * decayRate);

    // Impart momentum
    this.angularVelocity = Math.max(-28, Math.min(28, initialVelocity));

    // LOCK: Start 2.0-second cooldown period!
    this.cooldownUntil = now + this.cooldownDurationMs;
    this.isArmedForMovement = false;
    this.positionHistory = [];
    return true;
  }

  /**
   * Manually trigger simulated wave with 2-second lock
   */
  public simulateWave(velocity: number) {
    const now = performance.now();
    this.cooldownUntil = 0;
    this.isArmedForMovement = true;
    this.triggerMovementAndLock(velocity, false);
  }

  /**
   * Process video frame or offscreen canvas and extract gesture + velocity state
   */
  public async estimateHand(
    source: HTMLVideoElement | HTMLCanvasElement,
    isMirrored: boolean = true
  ): Promise<{
    gesture: GestureDetectionState;
    rawLandmarks: LandmarkPoint[] | null;
  }> {
    const now = performance.now();
    const isCoolingDown = now < this.cooldownUntil;
    const cooldownRemainingMs = isCoolingDown ? Math.max(0, Math.round(this.cooldownUntil - now)) : 0;

    // Reset arming when cooldown finishes
    if (!isCoolingDown && !this.isArmedForMovement) {
      this.isArmedForMovement = true;
      this.positionHistory = [];
      this.smoothedVelocityX = 0;
    }

    const defaultState: GestureDetectionState = {
      handDetected: false,
      isGrabbing: false,
      gestureAction: isCoolingDown ? 'cooldown' : this.angularVelocity !== 0 ? 'drifting' : 'searching',
      confidence: 0,
      pinchDistance: 1.0,
      pinchThreshold: this.pinchThreshold,
      gripCenter: null,
      wristPosition: null,
      palmPosition: null,
      palmBox: null,
      rawAngle: 0,
      angleDelta: 0,
      direction: 'static',
      handedness: 'Unknown',
      controlMode: this.controlMode,
      palmVelocityX: 0,
      palmSpeed: 0,
      isWaving: false,
      waveDirection: 'none',
      angularVelocity: this.angularVelocity,
      isDrifting: Math.abs(this.angularVelocity) > 0.05,
      totalWaveDriftDeg: this.projectedWaveDrift,
      isCoolingDown,
      cooldownRemainingMs,
      cooldownDurationMs: this.cooldownDurationMs,
    };

    const isReady = 'readyState' in source ? source.readyState >= 2 : true;
    if (!this.detector || !source || !isReady) {
      return { gesture: defaultState, rawLandmarks: null };
    }

    const sourceWidth = 'videoWidth' in source ? (source.videoWidth || 640) : source.width;
    const sourceHeight = 'videoHeight' in source ? (source.videoHeight || 480) : source.height;

    try {
      const hands = await this.detector.estimateHands(source, {
        flipHorizontal: false,
      });

      if (!hands || hands.length === 0) {
        this.resetGripHistory();
        this.positionHistory = [];
        return { gesture: defaultState, rawLandmarks: null };
      }

      const hand = hands[0];
      const confidence = hand.score ?? 0.9;
      // Sensitivity threshold filter
      if (confidence < this.palmSensitivity) {
        this.resetGripHistory();
        return { gesture: defaultState, rawLandmarks: null };
      }

      const keypoints = hand.keypoints as LandmarkPoint[];

      if (!keypoints || keypoints.length < 21) {
        this.resetGripHistory();
        return { gesture: defaultState, rawLandmarks: null };
      }

      // Landmarks
      const wrist = keypoints[0];
      const thumbTip = keypoints[4];
      const indexTip = keypoints[8];
      const middleMCP = keypoints[9];
      const middleTip = keypoints[12];
      const pinkyMCP = keypoints[17];
      const indexMCP = keypoints[5];

      const handScale = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y) || 100;

      // 1. Calculate Palm Object Detection Bounding Box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < keypoints.length; i++) {
        const kp = keypoints[i];
        if (kp.x < minX) minX = kp.x;
        if (kp.x > maxX) maxX = kp.x;
        if (kp.y < minY) minY = kp.y;
        if (kp.y > maxY) maxY = kp.y;
      }
      const pad = 10;
      const boxX = Math.max(0, (minX - pad) / sourceWidth);
      const boxY = Math.max(0, (minY - pad) / sourceHeight);
      const boxW = Math.min(1 - boxX, (maxX - minX + pad * 2) / sourceWidth);
      const boxH = Math.min(1 - boxY, (maxY - minY + pad * 2) / sourceHeight);
      const palmBox = { xMin: boxX, yMin: boxY, width: boxW, height: boxH };

      // Palm Centroid directly from Bounding Box
      const palmCenterX = boxX + boxW / 2;
      const palmCenterY = boxY + boxH / 2;

      let currentVx = 0;
      let palmSpeed = 0;
      let isWaveTriggeredNow = false;
      let waveDir: 'left' | 'right' | 'none' = 'none';

      // 2. Track Palm Movement & Handle 2-Second Lock
      if (this.controlMode === 'palm_drift') {
        if (!isCoolingDown && this.isArmedForMovement) {
          this.positionHistory.push({ x: palmCenterX, y: palmCenterY, time: now });

          // Keep last 150ms of position samples
          while (this.positionHistory.length > 0 && now - this.positionHistory[0].time > 150) {
            this.positionHistory.shift();
          }

          if (this.positionHistory.length >= 2) {
            const oldest = this.positionHistory[0];
            const newest = this.positionHistory[this.positionHistory.length - 1];
            const dt = (newest.time - oldest.time) / 1000;
            if (dt > 0.02) {
              currentVx = (newest.x - oldest.x) / dt;
            }
          }

          this.smoothedVelocityX = this.smoothedVelocityX * 0.35 + currentVx * 0.65;
          palmSpeed = Math.abs(this.smoothedVelocityX);

          // Once palm moves with sufficient speed -> TAKE ONLY THIS MOVEMENT and start 2s wait!
          if (palmSpeed >= 0.30) {
            const effectiveDir = isMirrored ? -this.smoothedVelocityX : this.smoothedVelocityX;
            waveDir = effectiveDir > 0 ? 'right' : 'left';

            // Trigger and immediately enter 2.0-second cooldown!
            const success = this.triggerMovementAndLock(this.smoothedVelocityX, isMirrored);
            if (success) {
              isWaveTriggeredNow = true;
            }
          }
        } else {
          // In cooldown: ignore movements
          this.positionHistory = [];
          this.smoothedVelocityX = 0;
          palmSpeed = 0;
        }
      }

      // 3. Pinch Distance (for optional pinch_twist mode)
      const thumbIndexDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const thumbMiddleDist = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);
      const effectivePinchDist = Math.min(thumbIndexDist, thumbMiddleDist);
      const normalizedPinchRatio = effectivePinchDist / handScale;

      const gripCenterX = (thumbTip.x + indexTip.x) / (2 * sourceWidth);
      const gripCenterY = (thumbTip.y + indexTip.y) / (2 * sourceHeight);
      const wristX = wrist.x / sourceWidth;
      const wristY = wrist.y / sourceHeight;

      let isGrabbing = this.isGrabbingState;
      if (normalizedPinchRatio < this.pinchThreshold) {
        this.consecutiveGrabFrames++;
        this.consecutiveReleaseFrames = 0;
        if (this.consecutiveGrabFrames >= 2) isGrabbing = true;
      } else if (normalizedPinchRatio > this.pinchThreshold + 0.1) {
        this.consecutiveReleaseFrames++;
        this.consecutiveGrabFrames = 0;
        if (this.consecutiveReleaseFrames >= 2) isGrabbing = false;
      }
      this.isGrabbingState = isGrabbing;

      // 4. Raw Hand Angle
      const vectorX = (thumbTip.x + indexTip.x) / 2 - wrist.x;
      const vectorY = (thumbTip.y + indexTip.y) / 2 - wrist.y;
      const currentAngle = (Math.atan2(vectorY, vectorX) * 180) / Math.PI;

      let angleDelta = 0;
      let rotationDir: 'cw' | 'ccw' | 'static' = 'static';

      if (this.controlMode === 'pinch_twist' && isGrabbing) {
        if (this.lastProcessedAngle !== null) {
          let diff = currentAngle - this.lastProcessedAngle;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          if (Math.abs(diff) < 0.6) diff = 0;

          diff = diff * this.sensitivity;
          this.smoothedAngleDelta = this.smoothedAngleDelta * 0.35 + diff * 0.65;
          angleDelta = this.smoothedAngleDelta;

          if (angleDelta > 0.4) rotationDir = 'cw';
          else if (angleDelta < -0.4) rotationDir = 'ccw';
        }
        this.lastProcessedAngle = currentAngle;
      } else {
        this.lastProcessedAngle = null;
        this.smoothedAngleDelta = 0;
      }

      // Determine active gesture action label
      let action: GestureDetectionState['gestureAction'] = 'ready';
      if (this.controlMode === 'palm_drift') {
        if (isWaveTriggeredNow) {
          action = waveDir === 'right' ? 'waving_right' : 'waving_left';
        } else if (isCoolingDown) {
          action = 'cooldown';
        } else if (Math.abs(this.angularVelocity) > 0.1) {
          action = 'drifting';
        } else {
          action = 'ready';
        }
      } else {
        if (isGrabbing) {
          if (rotationDir === 'cw') action = 'rotating_cw';
          else if (rotationDir === 'ccw') action = 'rotating_ccw';
          else action = 'grabbed';
        }
      }

      const handednessStr = hand.handedness === 'Left' ? 'Left' : hand.handedness === 'Right' ? 'Right' : 'Unknown';

      return {
        gesture: {
          handDetected: true,
          isGrabbing,
          gestureAction: action,
          confidence: hand.score ?? 0.95,
          pinchDistance: Math.max(0, Math.min(1.5, normalizedPinchRatio)),
          pinchThreshold: this.pinchThreshold,
          gripCenter: { x: gripCenterX, y: gripCenterY },
          wristPosition: { x: wristX, y: wristY },
          palmPosition: { x: palmCenterX, y: palmCenterY },
          palmBox,
          rawAngle: currentAngle,
          angleDelta,
          direction: rotationDir,
          handedness: handednessStr,
          controlMode: this.controlMode,
          palmVelocityX: this.smoothedVelocityX,
          palmSpeed,
          isWaving: isWaveTriggeredNow,
          waveDirection: waveDir,
          angularVelocity: this.angularVelocity,
          isDrifting: Math.abs(this.angularVelocity) > 0.05,
          totalWaveDriftDeg: this.projectedWaveDrift,
          isCoolingDown,
          cooldownRemainingMs,
          cooldownDurationMs: this.cooldownDurationMs,
        },
        rawLandmarks: keypoints,
      };
    } catch (e) {
      console.error('Error during hand estimation:', e);
      return { gesture: defaultState, rawLandmarks: null };
    }
  }

  private resetGripHistory() {
    this.isGrabbingState = false;
    this.consecutiveGrabFrames = 0;
    this.consecutiveReleaseFrames = 0;
    this.lastProcessedAngle = null;
    this.smoothedAngleDelta = 0;
  }
}

export const handDetectorService = new HandDetectorService();

/**
 * Hand Skeleton connections
 */
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base
  [5, 9], [9, 13], [13, 17],
];
