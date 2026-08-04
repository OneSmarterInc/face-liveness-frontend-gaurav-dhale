# Face Liveness — Follow-up Guidance (v3)

For: Gaurav
From: Vikram
Repo: OneSmarterInc/face-liveness-frontend-gaurav-dhale
Reviewed at: f0aa6ca ("face_embedding_functionality_integrated")

---

## First — the recognition work is well done

I want to be clear about this before the one correction, because the correction is not about the quality of what you built.

You wired InsightFace's w600k_r50 model into the browser with ONNX Runtime and you did it correctly. The 5-point similarity alignment to the 112x112 ArcFace template matches InsightFace's own norm_crop, the preprocessing (CHW, normalized to minus-one-to-one) is right, and you L2-normalize the 512-dimension output the way the model expects. On top of that you found and fixed a real performance bug — the duplicate FaceLandmarker loading a second WASM runtime — and you did it the right way, by passing the landmarks in from useFaceMesh instead of re-detecting them, with a clear note explaining why. You also made the embedding best-effort so a slow model never blocks submission, and you cleaned up the stray src.zip. That's good, careful work.

So this note is not "the embedding is wrong." The embedding is computed well. It's about where it's computed, and it's the same idea as last time, on the most important piece of the system.

---

## The one that has to move: the embedding is computed on the client

Here is the subtle part, and it's the same shape as the verdict problem from v2. Right now the browser computes the face embedding and puts it in the payload as face_embedding, next to final_liveness_result and the per-challenge passed: true. Everything that produces the biometric runs on the user's machine.

The embedding is the crown jewel. It's the thing that gets stored in the vault and reused to recognize this person later. And because it's computed on the client and trusted, an attacker doesn't need the app, the camera, or a live face. They take a photo of the person they want to impersonate, run it through the exact same w600k_r50 model — which is public, and which we are now serving to every browser at /models/w600k_r50.onnx — and post that person's 512-dimension embedding directly, with the result marked passed. The server enrolls or matches a biometric that no real human was ever present for.

This is worse than the client-side verdict, for two reasons. First, a forged embedding poisons the vault permanently, and a leaked or attacker-chosen biometric can't be re-issued. Second, it isn't caught by the human watching during the POC. A human verifier can see that the person on camera is real; they cannot see that the embedding in the payload was computed from a photo posted straight to the API. So the interim allowance that lets the liveness verdict stay on the client during the POC does not extend to the embedding. The embedding has to be produced by the trusted side.

The way to feel it: the verdict being on the client was a lock on the wrong side of the door. The embedding being on the client is the vault's contents being written by whoever is standing outside.

---

## What the real fix looks like

Same principle as v2: the client sends evidence, the server produces the artifact. For recognition, the artifact is the embedding.

The client's job is to capture and upload the frame — the best liveness frame — bound to the session nonce, along with the raw liveness evidence. The server aligns that frame, runs the recognition model, and produces the embedding that actually gets stored or matched. The model moves to the server; we stop shipping the weights to the browser. Nothing about your alignment and preprocessing work is wasted — it's the exact recipe the server runs, just moved to where it can be trusted.

Keep your client-side embedding if you want it, but only for UX. It's genuinely nice to give the user an instant "looks like you" hint while the server does the authoritative work. It just can't be the embedding of record.

While you're in there, finish the evidence task from v2, because it's the same upload. The payload still sends only conclusions — the liveness verdict, the hardcoded passed: true, and now the embedding — and no raw evidence. Send the per-frame yaw series with timestamps, the EAR series for the blink, the captured frame, and the nonce. Once the frame and the raw signals are going up, the server can recompute the verdict and produce the embedding from the same upload, and the client stops being trusted for anything that matters.

---

## The one question for the backend, again

I still can't see the backend from the frontend, so this is the thing to pin down with whoever owns it, and it now matters twice over: does the server store or trust face_embedding and final_liveness_result as sent, or does it recompute them? If it stores the client's embedding, the vault is being seeded right now with data an attacker can choose. That's the first thing to confirm before anything else.

---

## Small cleanups while you're there

Two leftover debug lines (console.log for "blob" and "bitmap") should come out. And the per-challenge passed: true is still hardcoded — once the server recomputes from evidence, that field stops being something the client asserts at all.

---

## The line, extended

Never trust the label — and a client-computed embedding is a label too, no matter how correctly it was computed. The trusted side has to reproduce the biometric from the frame, the same way it has to reproduce the verdict from the evidence. Your recognition code is good enough to be the thing the server runs. It just has to run where the user can't reach it.
