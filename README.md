# ErgoVision Posture Coach

A static webcam prototype that uses browser-based vision recognition to estimate seated posture and prompt ergonomic corrections while working at a laptop or PC.

## Features

- Live webcam capture with `getUserMedia`.
- Browser-side MediaPipe Pose Landmarker inference.
- Seated posture scoring for head centering, shoulder level, neck stacking, upright height, and screen distance.
- Per-indicator switches so users can exclude unnecessary signals from scoring and feedback.
- Personal upright posture calibration saved locally.
- Optional known-distance calibration for approximate screen-distance estimates in centimeters.
- Configurable alert sound: single beep or interval beeps.
- Alert delay, threshold, volume, and sensitivity presets.
- Visual toast alerts that can be switched on or off.
- Hide-video mode so posture processing continues without showing the camera image.
- Camera selector for switching between laptop and external webcams.
- Session stats for good posture time, poor posture time, alert count, and longest poor-posture streak.
- Break reminders with configurable interval.
- Reset calibration, reset settings, export settings, and import settings.

## Privacy

Video frames are processed client-side in the browser. The app does not upload webcam video to a server. The MediaPipe JavaScript, WASM runtime, and pose model are loaded from CDN for this prototype.

Calibration, alert settings, enabled indicators, break reminder state, and distance settings are stored locally in the browser with `localStorage` under `ergovision-settings-v1`. They persist after refresh or relaunch on the same browser, device, URL, and port.

## Run Locally

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

Those URLs provide the MediaPipe JavaScript, WASM runtime, and pose model.

## Typical Use

1. Start the webcam.
2. Choose the camera if you have more than one.
3. Sit upright with your head and both shoulders visible.
4. Set **Known distance cm** if you want approximate centimeter-based distance feedback.
5. Click **Calibrate upright** to save your seated baseline.
6. Optionally click **Calibrate distance** from the same position.
7. Tune sensitivity, alert delay, sound pattern, break reminder, and enabled indicators.

Screen distance is estimated from apparent head and shoulder size. A single webcam cannot measure exact centimeters without camera calibration, a known reference, or depth hardware.

## GitHub Pages

This app can be hosted on GitHub Pages because it is static. Publish `index.html`, `styles.css`, `app.js`, and `README.md` from the repository root. GitHub Pages serves over HTTPS, which is required for webcam access outside `localhost`.

This is not medical advice or a clinical ergonomic assessment. It is a development prototype for posture feedback.