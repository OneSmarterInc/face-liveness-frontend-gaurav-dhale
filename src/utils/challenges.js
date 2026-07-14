export const ChallengeType = {
  CENTER_FACE: "CENTER_FACE",
  TURN_LEFT: "TURN_LEFT",
  TURN_RIGHT: "TURN_RIGHT",
  HOLD_STILL: "HOLD_STILL",
  BLINK: "BLINK",
};

export const DEFAULT_CHALLENGES = [
  {
    id: 1,
    type: ChallengeType.TURN_LEFT,
    label: "Turn Left",
  },
  {
    id: 2,
    type: ChallengeType.TURN_RIGHT,
    label: "Turn Right",
  },
];