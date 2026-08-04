# Face Liveness — Developer Guidance

**For:** Gaurav
**Repo:** OneSmarterInc/face-liveness-frontend-gaurav-dhale
**Based on:** a full read of the code at `fd16bfe`

---

## First, what you got right — and it's the hard part

This is strong work. You built the part of liveness that most people get wrong, and you built it properly.

The detection is real. You're running MediaPipe face-mesh, computing yaw from actual landmarks (nose tip against the cheek midpoint, normalised by face width), not faking motion. The state machine is genuinely careful: it makes the user return to neutral between challenges, it checks that movement happened smoothly across a history window instead of jumping, it settles for several frames before capture, and it has a real timeout, real failure reasons, face-lost detection, and retry. You fetched a session nonce from the server and you wrote an ARCHITECTURE doc. Someone who does all of that understood the assignment.

So this note is not "start over." It's one flaw, and it's the flaw that decides whether any of the rest counts.

---

## THE MUST FIX — the client decides the verdict, so there is no verdict

Look at `buildVerificationPayload`. It sends `final_liveness_result: "passed"` and every challenge hardcoded `passed: true`. The browser decides it passed, and then tells the server it passed.

That means the check is bypassable by anyone who skips your UI entirely. Create a session, POST `{ final_liveness_result: "passed" }`, and you're through — no face, no camera, no MediaPipe. Every bit of the yaw math you wrote is beautiful and irrelevant, because the security decision is made in the one place an attacker fully controls: their own browser.

This is the same mistake that has shown up across the whole project in different costumes — a check that looks real and decides nothing, because the decision isn't made where it can be trusted. Yours is the most sophisticated-looking version, which is exactly why it's worth being blunt: a liveness check is only as strong as *where the verdict is made*, and right now it's made on the attacker's machine.

The fix is to move the verdict to the server. The client's job is to collect and send *evidence*, not a conclusion. Send the raw per-frame yaw values with timestamps, the session nonce, and the challenge sequence that was actually performed. The server decides pass or fail. The client should never send the word "passed" — it should send the numbers and let the server say passed.

Right now, helpfully, you're only half-wired for this: `createSession` is called but `completeSession` is never actually invoked from `LivenessCheck`, so the payload isn't even being sent yet. That's good timing — you can wire the server round-trip and fix the authority direction in the same change, before the bad shape sets.

---

## THE SECOND FIX — the challenge order is fixed, so a recording beats it

The sequence is always TURN_LEFT then TURN_RIGHT. Even once the server judges the evidence, a pre-recorded video of someone turning left then right replays through this perfectly, because the attacker knows the order in advance.

Real liveness needs the *server* to choose a random challenge order per session, hand it to the client, and then verify that this specific order was the one performed, tied to the session nonce. A recording can't be prepared in advance for an order it doesn't know.

You clearly already know this — you wrote `generateRandomPromptSequence` and you fetch a session nonce. But `generateRandomPromptSequence` is never called anywhere (it's dead code), and the nonce isn't bound into the decision. The pieces are sitting on the bench. The fix is to have the server generate the order, deliver it with the session, and check the performed order against it.

---

## Smaller things

The BLINK challenge is stubbed to `return true` with a "Blink not implemented" warning. That's an honest TODO, which is fine, but note it's the same family as the main bug — a challenge that always passes — so it must not ship enabled until it actually evaluates a blink.

`platform: "android"` and `app_version: "1.0.0"` are hardcoded in the payload. Minor, but they should reflect reality once this runs on device.

---

## The one line for the whole team

This is the third audit in a row where the finding reduces to the same sentence, so it's worth saying plainly and keeping: **never trust the label, reproduce the number.** Here the client literally sends a label that says "passed," and nothing on the trusted side reproduced it. Your detection code is good enough that it's worth protecting with a server that actually checks it.
