# Liveness — Internal Standard and One-Year Pathway

**For:** Gaurav
**Scope:** You own this workstream. This document is the standard you build against and the
pathway for the next twelve months. The destination is a liveness system we improved
ourselves, measured honestly, with claims that never outrun what we've tested.

---

## The decision behind this

We are building our own liveness rather than licensing a certified engine. That's a
deliberate choice, and it comes with one obligation: we adopt the industry standard's own
metrics as our internal benchmarks, so "improving" is a measured curve, not a feeling. We
don't buy external certification until a customer demands it. Until then, we certify
ourselves, against ourselves, on a schedule.

---

## The standard: two numbers, measured on a fixed attack set

The international standard for liveness (ISO/IEC 30107-3) reduces to two error rates. We
measure both, every cycle:

**APCER — attack acceptance rate.** Of the attack attempts in our test set, how many got
through? This is the security number. Lower is better, and zero against our current attack
set is the standing goal.

**BPCER — real-person rejection rate.** Of genuine, live people attempting to verify, how
many were wrongly rejected? This is the usability and fairness number. A check that blocks
attacks by also blocking real students has failed differently, not succeeded.

The tension between these two numbers is the whole discipline. Tightening one usually
worsens the other. We track both so a "security improvement" that quietly starts rejecting
real people is visible immediately.

**The capture-quality rule sits under BPCER.** NIST's findings are clear that false rejects
are driven heavily by capture conditions — under-exposure of darker skin, bad framing, bad
pitch angle. Our student population makes this non-negotiable: the capture layer must
actively check lighting and framing before accepting a frame, and BPCER must be measured
across a range of skin tones and lighting conditions, not just ideal ones. A system that's
accurate in a bright office and unfair in a dim hostel room fails our standard even if the
average looks good.

---

## The attack set

A fixed, versioned collection of attacks we run every cycle. It starts modest and grows
each quarter. Version it like code — when the set changes, the version number changes, and
results are always reported against a named version, so numbers stay comparable.

**Starting set (assemble in month one, total cost a few hundred dollars):**
- Printed photo attacks: several subjects, several print sizes and papers, held flat and
  curved.
- Screen replay attacks: photos and videos of enrolled subjects displayed on a phone and a
  laptop, including videos performing the challenge motions.
- Video replay of a real prior session (tests that server-chosen challenge order actually
  defeats recordings).
- Basic 2D mask: printed face cutout with eye holes.

**Growth path (added by quarter, below):** textured/curved paper masks, off-the-shelf
latex mask, deepfake/AI-generated video of an enrolled subject played to the camera, and a
cheap 3D-printed or silicone mask by year end.

Every attack run is logged: attack type, set version, date, result. The evidence goes to
the server; the verdict is computed on the server. That rule is permanent.

---

## The cadence

**Monthly:** run the full attack set, record APCER and BPCER, plot both against prior
months. One afternoon. If either number moves the wrong way, that's the month's priority
before any new feature.

**Quarterly:** expand the attack set (below), re-baseline, and write a one-page summary —
the two curves, what was added, what broke, what was fixed. That page is the workstream's
report to Vikram. No demo, a number.

---

## The one-year pathway

**Q1 — Honest foundation (months 1–3).**
Land the server-side verdict completely: client sends evidence (yaw series, EAR series,
timings, nonce, frames), server recomputes everything, nothing labeled "passed" crosses the
wire from the client. Assemble attack set v1 and run the first full baseline — those first
APCER/BPCER numbers are the mark everything else is measured against. Build the
capture-quality gate (lighting, framing, face size) into the client. Agree the integration
contract with Sakshi's seam: what startCheck() returns, async server round-trip, who owns
the camera. Exit criteria: verdict fully server-side, baseline published, contract signed
off, POC-ready.

**Q2 — Defeat the recording (months 4–6).**
Attack set v2 adds video replays performing challenges and curved/textured print attacks.
Server-chosen randomized challenge order verified end-to-end against the nonce. Blink (EAR)
fully evaluated server-side. Target: zero APCER against all replay attacks; BPCER measured
across at least three lighting conditions and a range of skin tones, with the spread
reported, not just the mean. Exit criteria: replay class fully defeated, fairness spread
published.

**Q3 — Defeat the mask and the deepfake (months 7–9).**
Attack set v3 adds an off-the-shelf latex mask and AI-generated video of an enrolled
subject. This is where passive signals enter: texture and frequency analysis, moiré and
screen-artifact detection, whatever the evidence supports — research the current
literature rather than inventing from scratch; this subfield is well published. Target:
measured, improving APCER against the mask and deepfake classes (zero is aspirational here,
the curve matters). Exit criteria: mask/deepfake classes in the monthly run, curve bending
down.

**Q4 — Harden and decide (months 10–12).**
Attack set v4 adds a cheap 3D mask. Full-year review: both curves over twelve months, the
fairness spread, and the honest gap between our numbers and what iBeta Level 2 tests. Then
the decision Vikram owns, informed by your numbers: stay internal, or pursue external
certification because a customer or the spinoff now warrants it. Exit criteria: the
year-in-review page, and a recommendation with numbers behind it.

---

## The claims rule (permanent)

What we say publicly stays inside what we've tested. "Every student passes our liveness
verification" is true the day the server-side check runs. "Certified" is not true until a
lab says so, and we don't imply it. If a class of attack isn't in our set yet, we don't
claim resistance to it. The system's honesty is the product's honesty.

## The one line

Never trust the label — reproduce the number. This whole document is that sentence turned
into a program: the label is "liveness works," and the number is APCER and BPCER, measured
monthly, on an attack set that grows quarterly, for a year.
