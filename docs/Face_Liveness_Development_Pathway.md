# Face Liveness — Development Pathway (Long-Term Plan)

For: Gaurav
From: Vikram
Date: 2026-07-16
Sits alongside: Face_Liveness_Guidance_v2.md (the server-owns-the-verdict note) and the internal standard / one-year pathway. This doc is the architecture road; those two still hold.

## The shape of this: a direction we hold firmly, a road we hold loosely

First, your ADR is right. You laid out the three options honestly and landed on Option 3 — the server owns both the evidence and the verdict — as the correct long-term architecture, and you saw that it's also where face recognition against an encrypted embedding naturally lives. That's exactly where we're going. I want to be clear that the judgment in that document is ahead of where a lot of people would be, and it's the reason this plan can be short.

So this isn't a spec that tells you to build one thing and stop. It's a destination and a road to it. We build an honest interim now, and we migrate toward the server-owns-everything architecture as we develop and as the research turns up better methods. The direction is fixed. The specific rungs are things we'll revise together as we learn more — treat every stage below as our current best plan, not a contract.

## The destination (Option 3)

The end state is the one your ADR recommends. The browser captures and uploads raw frames or a short clip. The server extracts the landmarks, computes the yaw and challenge completion itself, and renders the verdict. The client never decides anything that matters; it observes and reports. That same trusted server environment is where, later, we generate the face embedding and compare it against the stored, post-quantum-encrypted template. Liveness and recognition end up in one place we control.

We're building toward that because it's the only design where a modified browser can't forge a pass, and because it's the foundation the rest of the product (the vault, reusable verification) sits on.

## The interim (now): Option 1, but stop throwing the evidence away

For the current ten-student POC, the client-side check is acceptable — on one condition. During the POC a human is the real verifier. The person watching is the actual security gate, so the browser's pass/fail is a convenience for the user, not the thing anyone is trusting. That's the only situation where a client-decided verdict is safe, and it stops being safe the moment the human backstop is gone. This interim must never become the sole gate for a real user. When we move past the POC, the verdict moves to the server first.

There's one thing worth doing right now, though, because it costs almost nothing on the frontend and it's what makes the later stages cheap: start sending the evidence in the payload, even while the client still computes its convenience verdict. Send the raw per-frame yaw series with timestamps, the EAR series for the blink, the captured frame, and the session nonce. You're already buffering frames — wire that through instead of discarding it. Today the payload carries only a conclusion and no evidence at all, which means the server has nothing to recompute from even if it wanted to. Fix that now and every later stage is a step forward instead of a fresh start.

Keep the injectable seam (services.liveness.startCheck) so swapping the engine is one contained change, and keep versioning every check so we can re-verify a cohort if a later version reveals a weakness.

## The road between now and the destination

These are the rungs as we see them today. We'll adjust them as we go.

Stage 0, now: interim client check behind the human-verified POC, with full evidence sent alongside the verdict. The frontend can do all of this on its own, no backend dependency.

Stage 1: the backend stops trusting the client's verdict and recomputes it from the evidence you're already sending — the challenge order matches the server's chosen sequence, the yaw series actually shows the turns, the EAR series shows a real blink, the timing is within bounds, a capture exists. This is the first real security gain and it's the first question to settle with whoever owns the backend: does it recompute today, or does it trust the client? The answer decides how much of this stage is left.

Stage 2: move the vision itself server-side. The client uploads raw frames or a short clip and the server runs the landmark extraction and yaw computation, so even the measurements aren't taken on trust. This is Option 3, the destination.

Stage 3 and beyond: face embedding and the post-quantum-encrypted vault in that same trusted environment, plus the passive-signal and capture-quality work from the internal standard. This is where the research we're doing feeds in, and it's the part most likely to reshape the earlier rungs.

## Where flexibility comes in

Hold this pathway loosely on specifics. As we test methods and read more of the literature — passive liveness signals, capture-quality gating across skin tones and lighting, fairness testing — we'll revise the rungs and sometimes the order. That's expected, not a failure of the plan. The commitments that don't move are the direction (server owns the verdict, then owns the evidence) and the discipline: every shipped check names its version, and we measure honestly.

## Certification: build so we could, don't assume we will

We build and measure against the industry's own metrics — APCER and BPCER on a versioned attack set, capture quality and the fairness spread reported rather than a single average, using the ISO 30107-3 vocabulary. The point of measuring to that standard is that if a client ever requires external certification (iBeta L1 or L2), we could pursue it without re-architecting. I don't expect us to certify on our own initiative; certification is expensive and only worth it when the certificate itself is what a customer is buying. So the stance is simply that we keep the ability. We build to the bar, we hold the option, and we spend on the certificate only if someone asks for it.

Public claims stay inside what's been tested. "Verified" is true once the server-side check runs. We never imply "certified" until it is.

## The line, one more time

Never trust the label — and a verdict computed on the client is a label, no matter how carefully it was computed. Your ADR already says this better than most. The interim is fine because a human is holding the line during the POC; the pathway exists so that the server holds it after.
