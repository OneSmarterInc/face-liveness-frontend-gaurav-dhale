// ear (Eye Aspect Ratio)

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function toPoint(landmark, width, height) {
  return { x: landmark.x * width, y: landmark.y * height };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(landmarks, indices, width, height) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) =>
    toPoint(landmarks[i], width, height),
  );

  const horizontal = dist(p1, p4);
  if (horizontal === 0) return null;

  const vertical = dist(p2, p6) + dist(p3, p5);
  return vertical / (2 * horizontal);
}


export function calculateEAR(faceLandmarks, width, height) {
  if (!faceLandmarks || faceLandmarks.length === 0 || !width || !height) {
    return null;
  }

  const left = eyeAspectRatio(faceLandmarks, LEFT_EYE, width, height);
  const right = eyeAspectRatio(faceLandmarks, RIGHT_EYE, width, height);

  if (left === null && right === null) return null;
  if (left === null) return right;
  if (right === null) return left;

  return (left + right) / 2;
}