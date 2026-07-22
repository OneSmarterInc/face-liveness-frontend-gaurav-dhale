// Approximate pitch/roll from 2D MediaPipe landmarks (normalized 0-1
// coordinates). These are coarse geometric estimates for the telemetry
// evidence stream only — not a full 3D head-pose solve, and not used to
// drive any liveness decision (yaw, in yaw.js, remains the one used for
// that).

const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;

export function calculateRoll(faceLandmarks) {
  if (!faceLandmarks || faceLandmarks.length === 0) return 0;

  const left = faceLandmarks[LEFT_EYE_OUTER];
  const right = faceLandmarks[RIGHT_EYE_OUTER];

  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  return Math.round((angle * 180) / Math.PI);
}

export function calculatePitch(faceLandmarks) {
  if (!faceLandmarks || faceLandmarks.length === 0) return 0;

  const forehead = faceLandmarks[FOREHEAD];
  const chin = faceLandmarks[CHIN];
  const nose = faceLandmarks[NOSE_TIP];

  const faceHeight = chin.y - forehead.y;
  if (faceHeight === 0) return 0;

  const midpoint = (forehead.y + chin.y) / 2;
  const normalizedOffset = (nose.y - midpoint) / (faceHeight / 2);

  return Math.round(normalizedOffset * 45);
}
