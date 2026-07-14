export function calculateYaw(faceLandmarks) {
  if (!faceLandmarks || faceLandmarks.length === 0) {
    return 0;
  }

  // MediaPipe landmark indices
  const noseTip = faceLandmarks[1];
  const leftCheek = faceLandmarks[234];
  const rightCheek = faceLandmarks[454];

  const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
  const faceWidth = rightCheek.x - leftCheek.x;

  if (faceWidth === 0) return 0;

  // Normalized yaw (-1 to 1)
  const normalizedYaw = (noseTip.x - faceCenterX) / (faceWidth / 2);

  // Convert to approximate degrees
  return Math.round(normalizedYaw * 45);
}