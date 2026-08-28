# ErgoVision Posture Coach

A local-development webcam prototype that uses browser-based vision recognition to estimate seated posture and prompt ergonomic corrections.

## How it works

- Captures webcam video with `getUserMedia`.
- Runs MediaPipe Pose Landmarker in the browser on live video frames.
- Measures head centering, shoulder tilt, neck stacking, calibrated upright height, and relative screen distance.
- Shows visual pose landmarks, a posture score, corrective cues, and an optional sound alert.

Video frames are processed client-side in the browser. The MediaPipe model and WASM runtime are loaded from CDN for this prototype.

Calibration, alert settings, and enabled indicators are stored locally in the browser with `localStorage`. They persist after refresh or relaunch on the same browser, device, URL, and port.

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
2. Sit upright with your head and both shoulders visible.
3. Click **Calibrate upright** to save your seated baseline.
4. Lean, slouch, move closer to the screen, or tilt to test the feedback thresholds.

## Configuration

- Toggle each indicator on or off: head centered, shoulder level, neck stacked, upright height, and screen distance.
- Choose sound alert behavior: single beep or interval beeps.
- Adjust alert threshold, beep interval, and volume.
- Settings are saved locally under `ergovision-settings-v1`.

Screen distance is estimated relative to calibration by comparing apparent head and shoulder size in the webcam image. A single webcam cannot measure exact centimeters without camera calibration or another reference.

## GitHub Pages

This app can be hosted on GitHub Pages because it is static. Publish `index.html`, `styles.css`, `app.js`, and `README.md` from the repository root. GitHub Pages serves over HTTPS, which is required for webcam access outside `localhost`.

This is not medical advice or a clinical ergonomic assessment. It is a development prototype for posture feedback.


