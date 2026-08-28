# ErgoVision Posture Coach

A local-development webcam prototype that uses browser-based vision recognition to estimate seated posture and prompt ergonomic corrections.

## How it works

- Captures webcam video with `getUserMedia`.
- Runs MediaPipe Pose Landmarker in the browser on live video frames.
- Measures head centering, shoulder tilt, neck stacking, calibrated upright height, and relative screen distance.
- Shows visual pose landmarks, a posture score, corrective cues, and an optional sound alert.

Video frames are processed client-side in the browser. The MediaPipe model and WASM runtime are loaded from CDN for this prototype.

## Run

Serve the folder from localhost:

```bash
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

Use a Chromium-based browser for best WebGL/WASM performance. Browser webcam APIs require `localhost` or HTTPS.

If the app shows **Vision model unavailable**, allow access to:

- `https://cdn.jsdelivr.net`
- `https://storage.googleapis.com`

Those URLs provide the MediaPipe JavaScript, WASM runtime, and pose model for this prototype.

## Development Notes

1. Start the webcam.
2. Sit upright with head, shoulders, and hips visible.
3. Click **Calibrate upright**.
4. Lean, slouch, or tilt to test the feedback thresholds.

Screen distance is estimated relative to calibration by comparing apparent head and shoulder size in the webcam image. A single webcam cannot measure exact centimeters without camera calibration or another reference.

This is not medical advice or a clinical ergonomic assessment. It is a development prototype for posture feedback.
