import { ChallengeType } from "./challenges";

const challengeMap = {
  center_face: ChallengeType.CENTER_FACE,
  turn_left: ChallengeType.TURN_LEFT,
  turn_right: ChallengeType.TURN_RIGHT,
  blink: ChallengeType.BLINK,
  hold_still: ChallengeType.HOLD_STILL,
};

export function mapBackendChallenges(sequence = []) {
  return sequence
    .map((challenge, index) => ({
      id: index + 1,
      type: challengeMap[challenge],
      label: challenge
        .replaceAll("_", " ")
        .replace(/\b\w/g, c => c.toUpperCase()),
    }))
    .filter(challenge => challenge.type);
}