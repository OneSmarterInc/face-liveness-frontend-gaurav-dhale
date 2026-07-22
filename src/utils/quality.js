
function toGrayscale(imageData) {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  return gray;
}

// Variance of the Laplacian — a standard, cheap "blur detector": higher
// variance means more high-frequency edge content, i.e. a sharper image.
function laplacianVariance(gray, width, height) {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const lap =
        4 * gray[idx] -
        gray[idx - 1] -
        gray[idx + 1] -
        gray[idx - width] -
        gray[idx + width];

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;

  const mean = sum / count;
  return sumSq / count - mean * mean;
}

// Empirical ceiling used to squash a raw Laplacian-variance value into a
// 0-1 sharpness score. Not a calibrated absolute threshold — tuned loosely
// against typical 480p-720p webcam frames.
const SHARPNESS_VARIANCE_CEILING = 1200;

function normalizeSharpness(variance) {
  return Math.max(0, Math.min(1, variance / SHARPNESS_VARIANCE_CEILING));
}

/**
 * @param {HTMLCanvasElement} canvas - the captured frame.
 * @returns {{ sharpness: number, brightness: number, quality_score: number }}
 *   sharpness/brightness are 0-1. quality_score is 0-100.
 */
export function computeImageQuality(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = toGrayscale(imageData);

  let brightnessSum = 0;
  for (let i = 0; i < gray.length; i++) brightnessSum += gray[i];
  const brightness = gray.length ? brightnessSum / gray.length / 255 : 0;

  const variance = laplacianVariance(gray, canvas.width, canvas.height);
  const sharpness = normalizeSharpness(variance);

  // Ideal exposure band is roughly 0.35-0.75; penalize frames outside it.
  const exposurePenalty =
    brightness < 0.35
      ? (0.35 - brightness) / 0.35
      : brightness > 0.75
        ? (brightness - 0.75) / 0.25
        : 0;

  const qualityScore = Math.round(
    Math.max(0, Math.min(1, sharpness * 0.7 + (1 - exposurePenalty) * 0.3)) *
      100,
  );

  return {
    sharpness: Number(sharpness.toFixed(2)),
    brightness: Number(brightness.toFixed(2)),
    quality_score: qualityScore,
  };
}
