// Aligns a face crop to the standard 112x112 ArcFace/InsightFace template
// using a 5-point similarity transform (the same scheme InsightFace's own
// `face_align.norm_crop` uses), so embeddings are comparable regardless of
// head pose/position in the source frame.
//
// The 5 points are derived from MediaPipe FaceLandmarker's 468/478-point
// mesh (eye corners, nose tip, mouth corners) rather than iris landmarks,
// since eye-corner indices are always present regardless of iris
// refinement settings.

const ARCFACE_TEMPLATE_112 = [
  [38.2946, 51.6963], // left eye
  [73.5318, 51.5014], // right eye
  [56.0252, 71.7366], // nose
  [41.5493, 92.3655], // left mouth corner
  [70.7299, 92.2041], // right mouth corner
];

const LEFT_EYE_CORNER_IDX = [33, 133];
const RIGHT_EYE_CORNER_IDX = [362, 263];
const NOSE_TIP_IDX = 1;
const MOUTH_CORNER_IDX = [61, 291];

function averagePoint(landmarks, indices, width, height) {
  let x = 0;
  let y = 0;

  for (const i of indices) {
    x += landmarks[i].x * width;
    y += landmarks[i].y * height;
  }

  return { x: x / indices.length, y: y / indices.length };
}

/**
 * Reduces a full MediaPipe face landmark list down to the 5 keypoints used
 * for ArcFace-style alignment, ordered by image-space left/right (not
 * anatomical left/right) so they line up with the template regardless of
 * the subject's orientation.
 */
export function extractFivePoints(landmarks, width, height) {
  if (!Array.isArray(landmarks) || landmarks.length < 468) {
    throw new Error(
      "extractFivePoints: expected a full MediaPipe face landmark list.",
    );
  }

  const eyeA = averagePoint(landmarks, LEFT_EYE_CORNER_IDX, width, height);
  const eyeB = averagePoint(landmarks, RIGHT_EYE_CORNER_IDX, width, height);
  const nose = {
    x: landmarks[NOSE_TIP_IDX].x * width,
    y: landmarks[NOSE_TIP_IDX].y * height,
  };
  const mouthA = {
    x: landmarks[MOUTH_CORNER_IDX[0]].x * width,
    y: landmarks[MOUTH_CORNER_IDX[0]].y * height,
  };
  const mouthB = {
    x: landmarks[MOUTH_CORNER_IDX[1]].x * width,
    y: landmarks[MOUTH_CORNER_IDX[1]].y * height,
  };

  const [leftEye, rightEye] = eyeA.x <= eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];
  const [leftMouth, rightMouth] =
    mouthA.x <= mouthB.x ? [mouthA, mouthB] : [mouthB, mouthA];

  return [leftEye, rightEye, nose, leftMouth, rightMouth];
}

// Closed-form SVD of a 2x2 matrix [[a,b],[c,d]] -> { U, S, Vt }
function svd2x2(a, b, c, d) {
  const E = (a + d) / 2;
  const F = (a - d) / 2;
  const G = (c + b) / 2;
  const H = (c - b) / 2;

  const Q = Math.sqrt(E * E + H * H);
  const R = Math.sqrt(F * F + G * G);

  const s1 = Q + R;
  const s2 = Q - R;

  const a1 = Math.atan2(G, F);
  const a2 = Math.atan2(H, E);

  const theta = (a2 - a1) / 2;
  const phi = (a2 + a1) / 2;

  const U = [
    [Math.cos(phi), -Math.sin(phi)],
    [Math.sin(phi), Math.cos(phi)],
  ];

  // Vt = transpose of the 2x2 rotation built from theta
  const Vt = [
    [Math.cos(theta), Math.sin(theta)],
    [-Math.sin(theta), Math.cos(theta)],
  ];

  return { U, S: [s1, s2], Vt };
}

function matMul2x2(m1, m2) {
  return [
    [
      m1[0][0] * m2[0][0] + m1[0][1] * m2[1][0],
      m1[0][0] * m2[0][1] + m1[0][1] * m2[1][1],
    ],
    [
      m1[1][0] * m2[0][0] + m1[1][1] * m2[1][0],
      m1[1][0] * m2[0][1] + m1[1][1] * m2[1][1],
    ],
  ];
}


function similarityTransform(src, dst) {
  const n = src.length;
  let srcMeanX = 0;
  let srcMeanY = 0;
  let dstMeanX = 0;
  let dstMeanY = 0;

  for (let i = 0; i < n; i++) {
    srcMeanX += src[i][0];
    srcMeanY += src[i][1];
    dstMeanX += dst[i][0];
    dstMeanY += dst[i][1];
  }

  srcMeanX /= n;
  srcMeanY /= n;
  dstMeanX /= n;
  dstMeanY /= n;

  let sxx = 0;
  let sxy = 0;
  let syx = 0;
  let syy = 0;
  let srcVar = 0;

  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - srcMeanX;
    const sy = src[i][1] - srcMeanY;
    const dx = dst[i][0] - dstMeanX;
    const dy = dst[i][1] - dstMeanY;

    sxx += sx * dx;
    sxy += sx * dy;
    syx += sy * dx;
    syy += sy * dy;
    srcVar += sx * sx + sy * sy;
  }

  srcVar /= n;
  sxx /= n;
  sxy /= n;
  syx /= n;
  syy /= n;

  const { U, S, Vt } = svd2x2(sxx, syx, sxy, syy);

  const det = U[0][0] * U[1][1] - U[0][1] * U[1][0];
  const detVt = Vt[0][0] * Vt[1][1] - Vt[0][1] * Vt[1][0];

  const d = [1, det * detVt < 0 ? -1 : 1];

  const R = matMul2x2(matMul2x2(U, [[d[0], 0], [0, d[1]]]), Vt);
  const scale = (S[0] * d[0] + S[1] * d[1]) / (srcVar || 1e-10);

  const tx = dstMeanX - scale * (R[0][0] * srcMeanX + R[0][1] * srcMeanY);
  const ty = dstMeanY - scale * (R[1][0] * srcMeanX + R[1][1] * srcMeanY);

  return [
    [scale * R[0][0], scale * R[0][1], tx],
    [scale * R[1][0], scale * R[1][1], ty],
  ];
}

/**
 * Warps `source` (an HTMLImageElement / ImageBitmap / HTMLCanvasElement /
 * HTMLVideoElement) into a new 112x112 canvas, aligned to the ArcFace
 * template using the given full MediaPipe landmark list.
 *
 * @param {*} source - drawImage-compatible image source
 * @param {Array<{x:number,y:number}>} landmarks - normalized (0-1) landmarks
 * @param {number} sourceWidth - pixel width of `source`
 * @param {number} sourceHeight - pixel height of `source`
 */
export function alignFaceTo112(source, landmarks, sourceWidth, sourceHeight) {
  const points = extractFivePoints(landmarks, sourceWidth, sourceHeight).map(
    (p) => [p.x, p.y],
  );

  const M = similarityTransform(points, ARCFACE_TEMPLATE_112);

  const out = document.createElement("canvas");
  out.width = 112;
  out.height = 112;

  const ctx = out.getContext("2d");

  ctx.save();
  // canvas setTransform(a, b, c, d, e, f) maps (x,y) -> (a*x+c*y+e, b*x+d*y+f)
  ctx.setTransform(M[0][0], M[1][0], M[0][1], M[1][1], M[0][2], M[1][2]);
  ctx.drawImage(source, 0, 0);
  ctx.restore();

  return out;
}
