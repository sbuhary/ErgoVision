# ErgoVision Posture Coach

ErgoVision is a static, browser-based posture coach that uses live webcam vision recognition to estimate seated posture and prompt ergonomic corrections while working at a laptop or PC.

The app runs fully in the browser, uses MediaPipe Pose Landmarker for pose detection, and stores user calibration/settings locally.

## Features

- Live webcam capture with `getUserMedia`.
- Browser-side MediaPipe Pose Landmarker inference.
- Seated posture scoring for head centering, shoulder level, neck stacking, upright height, and screen distance.
- Per-indicator switches so users can include or exclude posture signals from scoring and feedback.
- One-click enable/disable controls for all indicators.
- Personal upright posture calibration saved locally.
- Approximate screen-distance feedback with known-distance calibration.
- Configurable alert behavior with threshold, delay, sensitivity, volume, and sound pattern.
- Sound alert modes for single beep or interval beeps.
- Optional visual toast alerts.
- Optional browser notifications for users who prefer non-audio alerts.
- Break reminders with a configurable interval.
- Hide-video mode so posture processing continues while the webcam preview is hidden.
- Full-screen video mode with a mobile-friendly focus fallback.
- Collapsible alert settings drawer, collapsed by default to maximize dashboard space.
- Camera selector for switching between laptop and external webcams.
- Session stats for good posture time, poor posture time, alert count, and longest poor-posture streak.
- Reset calibration, reset settings, export settings, and import settings.
- Responsive dark UI with favicon/logo support.

## Privacy

Video frames are processed client-side in the browser. The app does not upload webcam video to a server.

The MediaPipe JavaScript bundle, WASM runtime, and pose model are loaded from CDN for this prototype:

- `https://cdn.jsdelivr.net`
- `https://storage.googleapis.com`

Calibration, alert settings, notification preferences, enabled indicators, break reminder state, selected camera, hide-video state, and distance settings are stored locally in the browser with `localStorage` under `ergovision-settings-v1`. They persist after refresh or relaunch on the same browser, device, URL, and port.

## Run Locally

Serve the folder from localhost:

```bash
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

A Chromium-based browser is recommended for best WebGL/WASM performance. Browser webcam APIs require `localhost` or HTTPS.

If you use a dev server such as Vite, make sure the app is opened from the served local URL, for example:

```text
http://localhost:5173
```

## Typical Use

1. Start the webcam.
2. Choose the camera if you have more than one.
3. Sit naturally with your head and both shoulders visible.
4. Click **Calibrate upright** from a comfortable seated working posture.
5. Set **Known distance cm** if you want approximate centimeter-based distance feedback.
6. Optionally click **Calibrate distance** from the same position.
7. Tune sensitivity, alert delay, sound pattern, browser notifications, break reminders, and enabled indicators.
8. Use **Hide video** if you want posture detection to continue without showing the camera preview.
9. Use **Full screen video** for a larger posture view. On mobile browsers, the app falls back to a full-screen-like focus mode when the native Fullscreen API is unavailable.

## Screen Distance Notes

Screen distance is estimated from apparent head and shoulder size. A single webcam cannot measure exact centimeters without camera calibration, a known reference, or depth hardware. Treat the distance signal as practical feedback, not a precise measurement device.

## GitHub Pages

This app can be hosted on GitHub Pages because it is static. Publish these files from the repository root:

- `index.html`
- `styles.css`
- `app.js`
- `favicon.svg`
- `README.md`

GitHub Pages serves over HTTPS, which is required for webcam access outside `localhost`.

For a user site URL like:

```text
https://your-username.github.io/
```

name the repository:

```text
your-username.github.io
```

For a project site URL like:

```text
https://your-username.github.io/ai-posture/
```

name the repository:

```text
ai-posture
```

## Browser Permissions

The app needs camera permission. Browser notifications are optional and only used if enabled in the alert settings.

If the app shows **Vision model unavailable**, check whether the browser, firewall, antivirus, or network policy is blocking CDN access to:

- `https://cdn.jsdelivr.net`
- `https://storage.googleapis.com`

## Limitations

This is not medical advice or a clinical ergonomic assessment. It is a development prototype for posture feedback.

Pose quality depends on lighting, webcam placement, framing, clothing contrast, and whether the head and shoulders are visible.
