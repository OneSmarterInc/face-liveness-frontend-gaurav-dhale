# Face Liveness — Next Steps (v4)

For: Gaurav
From: Vikram
Repo: OneSmarterInc/face-liveness-frontend-gaurav-dhale
Reviewed at: 030a7bd ("v2_frontend_complete")

---

## First — this one landed, and it landed right

You did exactly what the last two notes asked for, and you did it cleanly. The payload is now an evidence payload: no client verdict, no client-computed embedding, and a comment making clear that alignment, InsightFace, and the embedding all happen server-side now. Instead you upload the captured frame plus a real per-frame telemetry stream (timestamped yaw, pitch, roll, per-eye EAR, face-detected and confidence), the per-challenge timing, the server's challenge sequence, and the capture-quality numbers. You kept the client-side embedding hook but turned it into a logged no-op, and you turned the ten-check evaluator into a client-side pre-filter that just declines to upload a locally-failed attempt — which is exactly the "client result is UX only" line. That's the right architecture. Nice work.

So the frontend's evidence-and-upload job is essentially complete. Here's what to do next, in priority order.

## 1. Lock the evidence contract in writing (highest leverage)

The security of this whole thing now depends on the backend recomputing from what you send, and the backend can only do that against a fixed, unambiguous shape. Write the payload schema down as a short spec in the repo — every field you send under session, client, camera, detector, challenge_sequence, challenge_events, telemetry, and capture, with types and units (for example: telemetry is an array of samples, each with t in milliseconds since verification start, yaw in degrees, per-eye EAR, and so on). This is the frontend's deliverable to the backend, and once it's frozen, the client and server can move independently. Keep it versioned, the way the checks are versioned.

## 2. Get the backend question answered — this is the real gate

Sending evidence only buys security if the server actually recomputes. Sit down with whoever owns the backend and confirm two things: that the server recomputes the liveness verdict from the telemetry and frame you send, and that it generates the face embedding server-side from the uploaded frame. If it does, you're most of the way there. If it currently trusts anything the client sends, that is the priority to fix before this counts as done. You don't have to own the backend, but you do own driving this answer, because the frontend can't prove liveness by itself.

## 3. Frontend cleanups (quick)

Three small things. The src.zip build artifact got committed again — remove it and add it to .gitignore so it stops coming back. The telemetry array grows one sample per frame for the whole session, so cap it or downsample it to a sane rate (something like 10-15 samples per second is plenty for the server to see the motion) and confirm the backend accepts the resulting payload size next to the base64 frame. And take out the stray console.log lines in the submit path.

## 4. One thing to confirm with the backend, not to build yet

You currently send a single still frame plus the telemetry. The telemetry carries the motion, which is the right call, but check with the backend whether one frame is enough for it to both generate the embedding and bind it to the liveness, or whether it wants a few frames spanning the challenges so it can check the motion against the images. Don't build either version until that's decided — just raise it, since it's a server-side call.

## The line, same as always

The frontend's job is to observe and report, and it now does that honestly. The proof of a live human doesn't exist until the trusted side reproduces it from the evidence — so the contract and the backend recompute are the whole ballgame from here. Everything you've built is the raw material for that; the last step is making sure the server actually uses it.
