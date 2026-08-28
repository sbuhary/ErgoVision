const LANDMARKS = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
};

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const STORAGE_KEY = "ergovision-settings-v1";

const video = document.querySelector("#webcam");
const canvas = document.querySelector("#overlay");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#startButton");
const calibrateButton = document.querySelector("#calibrateButton");
const soundToggle = document.querySelector("#soundToggle");
const soundPattern = document.querySelector("#soundPattern");
const thresholdSlider = document.querySelector("#thresholdSlider");
const thresholdValue = document.querySelector("#thresholdValue");
const intervalSlider = document.querySelector("#intervalSlider");
const intervalValue = document.querySelector("#intervalValue");
const volumeSlider = document.querySelector("#volumeSlider");
const volumeValue = document.querySelector("#volumeValue");
const resetCalibrationButton = document.querySelector("#resetCalibrationButton");
const resetSettingsButton = document.querySelector("#resetSettingsButton");
const modelStatus = document.querySelector("#modelStatus");
const stageEmpty = document.querySelector("#stageEmpty");
const scoreValue = document.querySelector("#scoreValue");
const scoreRing = document.querySelector("#scoreRing");
const alertPanel = document.querySelector("#alertPanel");
const alertTitle = document.querySelector("#alertTitle");
const alertCopy = document.querySelector("#alertCopy");
const cueText = document.querySelector("#cueText");

const meters = {
  head: [document.querySelector("#headMeter"), document.querySelector("#headText")],
  shoulder: [document.querySelector("#shoulderMeter"), document.querySelector("#shoulderText")],
  torso: [document.querySelector("#torsoMeter"), document.querySelector("#torsoText")],
  height: [document.querySelector("#heightMeter"), document.querySelector("#heightText")],
  distance: [document.querySelector("#distanceMeter"), document.querySelector("#distanceText")],
};
const metricControls = {
  head: document.querySelector("#headEnabled"),
  shoulder: document.querySelector("#shoulderEnabled"),
  torso: document.querySelector("#torsoEnabled"),
  height: document.querySelector("#heightEnabled"),
  distance: document.querySelector("#distanceEnabled"),
};
const metricWeights = {
  head: 0.22,
  shoulder: 0.17,
  torso: 0.19,
  height: 0.27,
  distance: 0.15,
};

let poseLandmarker;
let drawingUtils;
let PoseLandmarkerClass;
let stream;
let lastVideoTime = -1;
let lastMetrics;
let calibration;
let lastBeepAt = 0;
let wasBelowAlertThreshold = false;
let audioContext;

loadSavedState();
init();
syncSettingsLabels();

startButton.addEventListener("click", async () => {
  if (stream) {
    stopCamera();
    return;
  }

  await startCamera();
});

calibrateButton.addEventListener("click", () => {
  if (!lastMetrics) return;
  calibration = {
    headHeightRatio: lastMetrics.raw.headHeightRatio,
    torsoHeightRatio: lastMetrics.raw.torsoHeightRatio,
    shoulderWidth: lastMetrics.raw.shoulderWidth,
    headWidth: lastMetrics.raw.headWidth,
  };
  saveState();
  cueText.textContent = "Calibration saved. Return to this upright seated position when alerts appear.";
});

[thresholdSlider, intervalSlider, volumeSlider].forEach((control) => {
  control.addEventListener("input", () => {
    syncSettingsLabels();
    saveState();
  });
});

[soundToggle, soundPattern].forEach((control) => {
  control.addEventListener("change", saveState);
});

resetCalibrationButton.addEventListener("click", () => {
  calibration = undefined;
  saveState();
  cueText.textContent = "Calibration reset. Sit upright and calibrate again when ready.";
  if (lastMetrics) updateUi(lastMetrics);
});

resetSettingsButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  soundToggle.checked = false;
  soundPattern.value = "single";
  thresholdSlider.value = "60";
  intervalSlider.value = "4";
  volumeSlider.value = "35";
  Object.values(metricControls).forEach((control) => {
    control.checked = true;
  });
  calibration = undefined;
  syncSettingsLabels();
  updateMetricAvailability();
  saveState();
  cueText.textContent = "Settings reset. Calibrate from your upright seated posture when ready.";
  if (lastMetrics) updateUi(lastMetrics);
});

Object.values(metricControls).forEach((control) => {
  control.addEventListener("change", () => {
    updateMetricAvailability();
    saveState();
    if (lastMetrics) updateUi(lastMetrics);
  });
});

async function init() {
  try {
    const mediaPipe = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs"
    );
    const { FilesetResolver, PoseLandmarker, DrawingUtils } = mediaPipe;
    PoseLandmarkerClass = PoseLandmarker;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    drawingUtils = new DrawingUtils(ctx);
    modelStatus.textContent = "Model ready";
  } catch (error) {
    modelStatus.textContent = "Model failed";
    alertTitle.textContent = "Could not load pose model";
    alertCopy.textContent =
      "The prototype needs access to jsDelivr and storage.googleapis.com to load MediaPipe assets.";
    stageEmpty.querySelector("strong").textContent = "Vision model unavailable";
    stageEmpty.querySelector("span").textContent =
      "Check internet access or allow the MediaPipe CDN/model URLs, then refresh.";
    startButton.disabled = true;
    console.error(error);
  }
}

async function startCamera() {
  if (!poseLandmarker) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    stageEmpty.hidden = true;
    startButton.textContent = "Stop webcam";
    calibrateButton.disabled = false;
    resizeCanvas();
    requestAnimationFrame(analyzeFrame);
  } catch (error) {
    alertPanel.className = "alert-panel bad";
    alertTitle.textContent = "Camera could not start";
    alertCopy.textContent =
      "Allow webcam permission and run the app from http://localhost or HTTPS.";
    console.error(error);
  }
}

function stopCamera() {
  stream.getTracks().forEach((track) => track.stop());
  stream = undefined;
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  stageEmpty.hidden = false;
  startButton.textContent = "Start webcam";
  calibrateButton.disabled = true;
  setWaitingState();
  wasBelowAlertThreshold = false;
}

function analyzeFrame() {
  if (!stream || video.readyState < HTMLMediaElement.HAVE_METADATA) return;

  resizeCanvas();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = poseLandmarker.detectForVideo(video, performance.now());
    renderResult(result);
  }

  requestAnimationFrame(analyzeFrame);
}

function renderResult(result) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = result.landmarks?.[0];
  if (!landmarks || !hasCoreVisibility(landmarks)) {
    setWaitingState();
    return;
  }

  drawPose(landmarks);
  lastMetrics = scorePosture(landmarks);
  updateUi(lastMetrics);
}

function drawPose(landmarks) {
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-canvas.width, 0);
  drawingUtils.drawConnectors(landmarks, PoseLandmarkerClass.POSE_CONNECTIONS, {
    color: "#5bb8ff",
    lineWidth: 4,
  });
  drawingUtils.drawLandmarks(landmarks, {
    color: "#2fd17c",
    fillColor: "#f4f7fb",
    radius: 4,
  });
  ctx.restore();
}

function scorePosture(landmarks) {
  const nose = landmarks[LANDMARKS.nose];
  const leftEar = landmarks[LANDMARKS.leftEar];
  const rightEar = landmarks[LANDMARKS.rightEar];
  const leftShoulder = landmarks[LANDMARKS.leftShoulder];
  const rightShoulder = landmarks[LANDMARKS.rightShoulder];
  const leftHip = landmarks[LANDMARKS.leftHip];
  const rightHip = landmarks[LANDMARKS.rightHip];

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const shoulderWidth = Math.max(distance(leftShoulder, rightShoulder), 0.001);
  const earsVisible = areVisible(landmarks, [LANDMARKS.leftEar, LANDMARKS.rightEar], 0.35);
  const headWidth = earsVisible ? distance(leftEar, rightEar) : null;
  const hipsVisible = areVisible(landmarks, [LANDMARKS.leftHip, LANDMARKS.rightHip], 0.45);
  const hipMid = hipsVisible ? midpoint(leftHip, rightHip) : null;
  const torsoHeight = hipMid ? distance(shoulderMid, hipMid) : null;
  const torsoHeightRatio = torsoHeight ? torsoHeight / shoulderWidth : null;
  const headHeightRatio = Math.max(0, shoulderMid.y - nose.y) / shoulderWidth;

  const headOffset = Math.abs(nose.x - shoulderMid.x) / shoulderWidth;
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;
  const torsoLean = hipMid ? Math.abs(shoulderMid.x - hipMid.x) / shoulderWidth : headOffset;
  const calibratedHeadHeight = calibration ? Math.max(calibration.headHeightRatio, 0.001) : 0;
  const headHeightDrop = calibration
    ? Math.max(0, calibratedHeadHeight - headHeightRatio) / calibratedHeadHeight
    : 0;
  const torsoHeightDrop =
    calibration?.torsoHeightRatio && torsoHeightRatio
      ? Math.max(0, calibration.torsoHeightRatio - torsoHeightRatio) / calibration.torsoHeightRatio
      : 0;
  const heightDrop = Math.max(headHeightDrop, torsoHeightDrop);
  const shoulderDistanceGain = calibration
    ? Math.max(0, shoulderWidth - calibration.shoulderWidth) / calibration.shoulderWidth
    : 0;
  const headDistanceGain =
    calibration?.headWidth && headWidth
      ? Math.max(0, headWidth - calibration.headWidth) / calibration.headWidth
      : 0;
  const distanceGain = Math.max(shoulderDistanceGain, headDistanceGain);

  const head = qualityFromError(headOffset, 0.08, 0.32);
  const shoulder = qualityFromError(shoulderTilt, 0.04, 0.18);
  const torso = qualityFromError(torsoLean, 0.08, 0.32);
  const height = calibration ? qualityFromError(heightDrop, 0.04, 0.18) : 100;
  const screenDistance = calibration ? qualityFromError(distanceGain, 0.1, 0.45) : 100;
  const scores = { head, shoulder, torso, height, distance: screenDistance };
  const total = calculateTotal(scores);

  return {
    total,
    head,
    shoulder,
    torso,
    height,
    distance: screenDistance,
    raw: {
      headOffset,
      shoulderTilt,
      torsoLean,
      headHeightRatio,
      torsoHeightRatio,
      shoulderWidth,
      headWidth,
      hipsVisible,
    },
  };
}

function updateUi(metrics) {
  metrics.total = calculateTotal(metrics);
  scoreValue.textContent = String(metrics.total);
  scoreRing.style.background = `conic-gradient(${scoreColor(metrics.total)} ${metrics.total * 3.6}deg, #323846 0deg)`;

  updateMetric("head", metrics.head);
  updateMetric("shoulder", metrics.shoulder);
  updateMetric("torso", metrics.torso);
  updateMetric("height", metrics.height);
  updateMetric("distance", metrics.distance);

  const problems = buildFeedback(metrics);
  alertPanel.className = `alert-panel ${severity(metrics.total)}`;

  if (problems.length === 0) {
    alertTitle.textContent = "Posture looks good";
    alertCopy.textContent = "Head, shoulders, and torso are aligned for this camera angle.";
    cueText.textContent = "Keep your screen near eye level and elbows close to your body.";
    return;
  }

  alertTitle.textContent = metrics.total < 60 ? "Adjust your posture" : "Small correction needed";
  alertCopy.textContent = problems[0];
  cueText.textContent = problems.join(" ");
  maybeBeep(metrics.total);
}

function buildFeedback(metrics) {
  const feedback = [];

  if (isMetricEnabled("head") && metrics.head < 72) {
    feedback.push("Center your head over your shoulders and bring your chin slightly back.");
  }
  if (isMetricEnabled("shoulder") && metrics.shoulder < 72) {
    feedback.push("Relax and level your shoulders; avoid lifting one side toward the ear.");
  }
  if (isMetricEnabled("torso") && metrics.torso < 72) {
    feedback.push("Stack your head over the center of your shoulders instead of leaning sideways.");
  }
  if (isMetricEnabled("height") && calibration && metrics.height < 72) {
    feedback.push("Sit taller against the calibrated upright height; lift through the chest and neck.");
  }
  if (isMetricEnabled("distance") && calibration && metrics.distance < 72) {
    feedback.push("Move back from the screen; your face or shoulders are closer than the calibrated position.");
  }
  if (!calibration) {
    feedback.push("Calibrate once from a comfortable upright seated posture for better slouch detection.");
  }

  return feedback;
}

function updateMetric(key, value) {
  const rounded = Math.round(value);
  const [meter, text] = meters[key];
  meter.value = rounded;
  meter.low = 60;
  meter.high = 78;
  meter.optimum = 100;
  text.textContent = `${rounded}`;
}

function setWaitingState() {
  scoreValue.textContent = "--";
  scoreRing.style.background = "conic-gradient(#9aa4b2 0deg, #323846 0deg)";
  Object.keys(meters).forEach((key) => updateMetric(key, 0));
  alertPanel.className = "alert-panel";
  alertTitle.textContent = "Waiting for a pose";
  alertCopy.textContent = "Keep your head and both shoulders visible in the camera frame.";
}

function maybeBeep(score) {
  const threshold = Number(thresholdSlider.value);
  const isBelowThreshold = score < threshold;
  const now = performance.now();

  if (!soundToggle.checked || !isBelowThreshold) {
    wasBelowAlertThreshold = isBelowThreshold;
    return;
  }

  if (soundPattern.value === "single" && wasBelowAlertThreshold) {
    return;
  }

  const intervalMs = Number(intervalSlider.value) * 1000;
  if (soundPattern.value === "interval" && now - lastBeepAt < intervalMs) {
    wasBelowAlertThreshold = true;
    return;
  }

  lastBeepAt = now;
  wasBelowAlertThreshold = true;
  playBeep();
}

function playBeep() {
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const volume = Number(volumeSlider.value) / 100;

  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume * 0.35, 0.0001), audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.3);
}

function syncSettingsLabels() {
  thresholdValue.textContent = thresholdSlider.value;
  intervalValue.textContent = `${Number(intervalSlider.value).toFixed(1)}s`;
  volumeValue.textContent = `${volumeSlider.value}%`;
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    if (saved.soundEnabled != null) soundToggle.checked = Boolean(saved.soundEnabled);
    if (saved.soundPattern) soundPattern.value = saved.soundPattern;
    if (saved.threshold) thresholdSlider.value = saved.threshold;
    if (saved.interval) intervalSlider.value = saved.interval;
    if (saved.volume) volumeSlider.value = saved.volume;
    if (saved.enabledMetrics) {
      Object.entries(metricControls).forEach(([key, control]) => {
        if (saved.enabledMetrics[key] != null) {
          control.checked = Boolean(saved.enabledMetrics[key]);
        }
      });
    }
    if (saved.calibration) calibration = saved.calibration;
    updateMetricAvailability();

    if (calibration) {
      cueText.textContent = "Saved calibration loaded. Recalibrate if your chair, screen, or camera moved.";
    }
  } catch (error) {
    console.warn("Could not load saved ErgoVision settings.", error);
  }
}

function saveState() {
  const state = {
    soundEnabled: soundToggle.checked,
    soundPattern: soundPattern.value,
    threshold: thresholdSlider.value,
    interval: intervalSlider.value,
    volume: volumeSlider.value,
    enabledMetrics: Object.fromEntries(
      Object.entries(metricControls).map(([key, control]) => [key, control.checked]),
    ),
    calibration,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function calculateTotal(scores) {
  const enabledEntries = Object.entries(metricWeights).filter(([key]) => isMetricEnabled(key));
  if (enabledEntries.length === 0) return 100;

  const weightSum = enabledEntries.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedScore = enabledEntries.reduce(
    (sum, [key, weight]) => sum + scores[key] * (weight / weightSum),
    0,
  );

  return Math.round(weightedScore);
}

function isMetricEnabled(key) {
  return metricControls[key]?.checked ?? true;
}

function updateMetricAvailability() {
  Object.entries(metricControls).forEach(([key, control]) => {
    const row = control.closest("article");
    row.classList.toggle("disabled", !control.checked);
  });
}

function hasCoreVisibility(landmarks) {
  return areVisible(landmarks, [LANDMARKS.nose, LANDMARKS.leftShoulder, LANDMARKS.rightShoulder], 0.55);
}

function areVisible(landmarks, indexes, threshold) {
  return indexes.every((index) => (landmarks[index].visibility ?? 1) > threshold);
}

function qualityFromError(value, ok, bad) {
  if (value <= ok) return 100;
  if (value >= bad) return 0;
  return Math.round(100 - ((value - ok) / (bad - ok)) * 100);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function severity(score) {
  if (score >= 78) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function scoreColor(score) {
  if (score >= 78) return "#2fd17c";
  if (score >= 60) return "#f2bc4d";
  return "#ff5f62";
}

function resizeCanvas() {
  const width = video.videoWidth || canvas.clientWidth;
  const height = video.videoHeight || canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}