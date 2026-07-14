const PROMPTS = [
    "LEFT",  // Rotate your head to your left (positive)
     "RIGHT", // Rotate your head to your right (negative)
     "FORWARD" // Look straight at the camera
    ];

export function generateRandomPromptSequence() {
  const sequence = [...PROMPTS];

  for (let i = sequence.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
  }

  return sequence;
}