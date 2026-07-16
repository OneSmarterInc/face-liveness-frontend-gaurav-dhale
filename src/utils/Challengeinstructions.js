import { ChallengeType } from "./challenges";


export const CHALLENGE_INSTRUCTIONS = {
  [ChallengeType.CENTER_FACE]:
    "Center your face in the frame and hold still.",
  [ChallengeType.TURN_LEFT]:
    "Slowly turn your head to the left until the prompt changes.",
  [ChallengeType.TURN_RIGHT]:
    "Slowly turn your head to the right until the prompt changes.",
  [ChallengeType.HOLD_STILL]:
    "Keep your face still and facing forward.",
  [ChallengeType.BLINK]:
    "Blink once, naturally, when prompted.",
};

const FALLBACK_INSTRUCTION = "Follow the on-screen prompt.";

export function getChallengeInstruction(type) {
  return CHALLENGE_INSTRUCTIONS[type] ?? FALLBACK_INSTRUCTION;
}