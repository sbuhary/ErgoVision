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
const cameraSelect = document.querySelector("#cameraSelect");
const soundToggle = document.querySelector("#soundToggle");
const hideVideoToggle = document.querySelector("#hideVideoToggle");
const soundPattern = document.querySelector("#soundPattern");
const sensitivitySelect = document.querySelector("#sensitivitySelect");
const thresholdSlider = document.querySelector("#thresholdSlider");
const thresholdValue = document.querySelector("#thresholdValue");
const delaySlider = document.querySelector("#delaySlider");
const delayValue = document.querySelector("#delayValue");
const intervalSlider = document.querySelector("#intervalSlider");
const intervalValue = document.querySelector("#intervalValue");
const volumeSlider = document.querySelector("#volumeSlider");
const volumeValue = document.querySelector("#volumeValue");
const resetCalibrationButton = document.querySelector("#resetCalibrationButton");
const resetSettingsButton = document.querySelector("#resetSettingsButton");
const breakToggle = document.querySelector("#breakToggle");
const breakSlider = document.querySelector("#breakSlider");
const breakValue = document.querySelector("#breakValue");
const breakStatus = document.querySelector("#breakStatus");
const exportSettingsButton = document.querySelector("#exportSettingsButton");
const importSettingsButton = document.querySelector("#importSettingsButton");
const importSettingsInput = document.querySelector("#importSettingsInput");
const knownDistanceInput = document.querySelector("#knownDistanceInput");
const minDistanceInput = document.querySelector("#minDistanceInput");
const calibrateDistanceButton = document.querySelector("#calibrateDistanceButton");
const toastToggle = document.querySelector("#toastToggle");
const notificationToggle = document.querySelector("#notificationToggle");
const toastRegion = document.querySelector("#toastRegion");
const modelStatus = document.querySelector("#modelStatus");
const stageEmpty = document.querySelector("#stageEmpty");
const scoreValue = document.querySelector("#scoreValue");
const scoreRing = document.querySelector("#scoreRing");
const alertPanel = document.querySelector("#alertPanel");
const alertTitle = document.querySelector("#alertTitle");
const alertCopy = document.querySelector("#alertCopy");
const cueText = document.querySelector("#cueText");
const statGoodTime = document.querySelector("#statGoodTime");
const statBadTime = document.querySelector("#statBadTime");
const statAlertCount = document.querySelector("#statAlertCount");
const statLongestPoor = document.querySelector("#statLongestPoor");

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
const sensitivityPresets = {
  relaxed: { cue: 64, head: [0.11, 0.38], shoulder: [0.06, 0.23], torso: [0.11, 0.38], height: [0.07, 0.25], distance: [0.16, 0.58] },
  normal: { cue: 72, head: [0.08, 0.32], shoulder: [0.04, 0.18], torso: [0.08, 0.32], height: [0.04, 0.18], distance: [0.1, 0.45] },
  strict: { cue: 80, head: [0.06, 0.24], shoulder: [0.03, 0.13], torso: [0.06, 0.24], height: [0.025, 0.13], distance: [0.07, 0.32] },
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
let alertBeganAt = 0;
let audioContext;
let breakStartedAt = Date.now();
let breakAlerted = false;
let toastBeganAt = 0;
let toastWasPoor = false;
let lastToastAt = 0;
let notificationBeganAt = 0;
let notificationWasPoor = false;
let lastNotificationAt = 0;
const sessionStats = {
  lastAt: 0,
  goodMs: 0,
  poorMs: 0,
  alertCount: 0,
  poorStreakStart: 0,
  longestPoorMs: 0,
  wasPoor: false,
};

loadSavedState();
init();
refreshCameraList();
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
    knownDistanceCm: Number(knownDistanceInput.value) || undefined,
    minDistanceCm: Number(minDistanceInput.value) || undefined,
  };
  saveState();
  cueText.textContent = "Calibration saved. Return to this upright seated position when alerts appear.";
});

[thresholdSlider, delaySlider, intervalSlider, volumeSlider, breakSlider, knownDistanceInput, minDistanceInput].forEach((control) => {
  control.addEventListener("input", () => {
    syncSettingsLabels();
    saveState();
  });
});

[soundToggle, hideVideoToggle, soundPattern, sensitivitySelect, breakToggle, toastToggle].forEach((control) => {
  control.addEventListener("change", () => {
    applyPrivacyMode();
    saveState();
  });
});

notificationToggle.addEventListener("change", async () => {
  await syncNotificationPermission();
  saveState();
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
  hideVideoToggle.checked = false;
  soundPattern.value = "single";
  sensitivitySelect.value = "normal";
  thresholdSlider.value = "60";
  delaySlider.value = "3";
  intervalSlider.value = "4";
  volumeSlider.value = "35";
  toastToggle.value = "on";
  notificationToggle.value = "off";
  breakToggle.value = "off";
  breakSlider.value = "45";
  knownDistanceInput.value = "60";
  minDistanceInput.value = "50";
  Object.values(metricControls).forEach((control) => {
    control.checked = true;
  });
  calibration = undefined;
  resetBreakReminder();
  syncSettingsLabels();
  updateMetricAvailability();
  saveState();
  cueText.textContent = "Settings reset. Calibrate from your upright seated posture when ready.";
  if (lastMetrics) updateUi(lastMetrics);
});

cameraSelect.addEventListener("change", async () => {
  saveState();
  if (stream) {
    stopCamera(false);
    await startCamera();
  }
});

Object.values(metricControls).forEach((control) => {
  control.addEventListener("change", () => {
    updateMetricAvailability();
    saveState();
    if (lastMetrics) updateUi(lastMetrics);
  });
});

exportSettingsButton.addEventListener("click", exportSettings);
importSettingsButton.addEventListener("click", () => importSettingsInput.click());
importSettingsInput.addEventListener("change", importSettings);
calibrateDistanceButton.addEventListener("click", () => {
  if (!lastMetrics) return;
  calibration ??= {};
  calibration.shoulderWidth = lastMetrics.raw.shoulderWidth;
  calibration.headWidth = lastMetrics.raw.headWidth;
  calibration.knownDistanceCm = Number(knownDistanceInput.value) || undefined;
  calibration.minDistanceCm = Number(minDistanceInput.value) || undefined;
  saveState();
  cueText.textContent = "Distance calibration saved from the current camera position.";
  updateUi(lastMetrics);
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
      video: getVideoConstraints(),
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    stageEmpty.hidden = true;
    startButton.textContent = "Stop webcam";
    calibrateButton.disabled = false;
    resizeCanvas();
    await refreshCameraList();
    requestAnimationFrame(analyzeFrame);
  } catch (error) {
    alertPanel.className = "alert-panel bad";
    alertTitle.textContent = "Camera could not start";
    alertCopy.textContent =
      "Allow webcam permission and run the app from http://localhost or HTTPS.";
    console.error(error);
  }
}

function stopCamera(resetUi = true) {
  stream.getTracks().forEach((track) => track.stop());
  stream = undefined;
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (resetUi) {
    stageEmpty.hidden = false;
    startButton.textContent = "Start webcam";
    calibrateButton.disabled = true;
    setWaitingState();
  }
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
  let estimatedDistanceCm = null;
  let distanceShortfall = 0;
  if (calibration?.knownDistanceCm) {
    const shoulderEstimate = calibration.shoulderWidth ? calibration.knownDistanceCm * (calibration.shoulderWidth / shoulderWidth) : null;
    const headEstimate = calibration.headWidth && headWidth ? calibration.knownDistanceCm * (calibration.headWidth / headWidth) : null;
    const estimates = [shoulderEstimate, headEstimate].filter(Boolean);
    estimatedDistanceCm = estimates.length ? estimates.reduce((sum, value) => sum + value, 0) / estimates.length : null;
    if (estimatedDistanceCm && calibration.minDistanceCm) {
      distanceShortfall = Math.max(0, calibration.minDistanceCm - estimatedDistanceCm) / calibration.minDistanceCm;
    }
  }
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
      estimatedDistanceCm,
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
  updateSessionStats(metrics.total);

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
  maybeShowToast(metrics.total, problems[0]);
  maybeShowBrowserNotification(metrics.total, problems[0]);
  maybeBeep(metrics.total);
}

function buildFeedback(metrics) {
  const feedback = [];
  const cueThreshold = getSensitivityPreset().cue;

  if (isMetricEnabled("head") && metrics.head < cueThreshold) {
    feedback.push("Center your head over your shoulders and bring your chin slightly back.");
  }
  if (isMetricEnabled("shoulder") && metrics.shoulder < cueThreshold) {
    feedback.push("Relax and level your shoulders; avoid lifting one side toward the ear.");
  }
  if (isMetricEnabled("torso") && metrics.torso < cueThreshold) {
    feedback.push("Stack your head over the center of your shoulders instead of leaning sideways.");
  }
  if (isMetricEnabled("height") && calibration && metrics.height < cueThreshold) {
    feedback.push("Sit taller against the calibrated upright height; lift through the chest and neck.");
  }
  if (isMetricEnabled("distance") && calibration && metrics.distance < cueThreshold) {
    feedback.push("Move back from the screen; you are closer than your calibrated distance.");
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
  delayValue.textContent = `${delaySlider.value}s`;
  breakValue.textContent = `${breakSlider.value}m`;
  syncNotificationControl();
  updateBreakReminder();
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    if (saved.soundEnabled != null) soundToggle.checked = Boolean(saved.soundEnabled);
    if (saved.hideVideo != null) hideVideoToggle.checked = Boolean(saved.hideVideo);
    if (saved.soundPattern) soundPattern.value = saved.soundPattern;
    if (saved.toastEnabled) toastToggle.value = saved.toastEnabled;
    if (saved.notificationEnabled) notificationToggle.value = saved.notificationEnabled;
    if (saved.sensitivity) sensitivitySelect.value = saved.sensitivity;
    if (saved.threshold) thresholdSlider.value = saved.threshold;
    if (saved.delay) delaySlider.value = saved.delay;
    if (saved.interval) intervalSlider.value = saved.interval;
    if (saved.volume) volumeSlider.value = saved.volume;
    if (saved.breakEnabled) breakToggle.value = saved.breakEnabled;
    if (saved.breakMinutes) breakSlider.value = saved.breakMinutes;
    if (saved.breakStartedAt) breakStartedAt = saved.breakStartedAt;
    if (saved.breakAlerted != null) breakAlerted = Boolean(saved.breakAlerted);
    if (saved.knownDistanceCm) knownDistanceInput.value = saved.knownDistanceCm;
    if (saved.minDistanceCm) minDistanceInput.value = saved.minDistanceCm;
    if (saved.enabledMetrics) {
      Object.entries(metricControls).forEach(([key, control]) => {
        if (saved.enabledMetrics[key] != null) {
          control.checked = Boolean(saved.enabledMetrics[key]);
        }
      });
    }
    if (saved.calibration) calibration = saved.calibration;
    updateMetricAvailability();
    applyPrivacyMode();

    if (calibration) {
      cueText.textContent = "Saved calibration loaded. Recalibrate if your chair, screen, or camera moved.";
    }
  } catch (error) {
    console.warn("Could not load saved ErgoVision settings.", error);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getCurrentState()));
}

function getCurrentState() {
  return {
    soundEnabled: soundToggle.checked,
    hideVideo: hideVideoToggle.checked,
    soundPattern: soundPattern.value,
    toastEnabled: toastToggle.value,
    notificationEnabled: notificationToggle.value,
    sensitivity: sensitivitySelect.value,
    threshold: thresholdSlider.value,
    delay: delaySlider.value,
    cameraId: cameraSelect.value,
    interval: intervalSlider.value,
    volume: volumeSlider.value,
    breakEnabled: breakToggle.value,
    breakMinutes: breakSlider.value,
    breakStartedAt,
    breakAlerted,
    knownDistanceCm: knownDistanceInput.value,
    minDistanceCm: minDistanceInput.value,
    enabledMetrics: Object.fromEntries(
      Object.entries(metricControls).map(([key, control]) => [key, control.checked]),
    ),
    calibration,
  };
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
function getSensitivityPreset() {
  return sensitivityPresets[sensitivitySelect.value] || sensitivityPresets.normal;
}
function getVideoConstraints() {
  const selectedCamera = cameraSelect.value;
  return selectedCamera
    ? { deviceId: { exact: selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } };
}

async function refreshCameraList() {
  if (!navigator.mediaDevices?.enumerateDevices) return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const savedCameraId = cameraSelect.dataset.savedCameraId || cameraSelect.value;

    cameraSelect.innerHTML = '<option value="">Default camera</option>';
    cameras.forEach((camera, index) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${index + 1}`;
      cameraSelect.append(option);
    });

    if ([...cameraSelect.options].some((option) => option.value === savedCameraId)) {
      cameraSelect.value = savedCameraId;
    }
  } catch (error) {
    console.warn("Could not enumerate cameras.", error);
  }
}
function applyPrivacyMode() {
  document.querySelector("#stage").classList.toggle("video-hidden", hideVideoToggle.checked);
}
function resetSessionStats() {
  sessionStats.lastAt = performance.now();
  sessionStats.goodMs = 0;
  sessionStats.poorMs = 0;
  sessionStats.alertCount = 0;
  sessionStats.poorStreakStart = 0;
  sessionStats.longestPoorMs = 0;
  sessionStats.wasPoor = false;
  renderSessionStats();
}

function updateSessionStats(score) {
  if (!stream) return;

  const now = performance.now();
  const elapsed = Math.max(0, now - (sessionStats.lastAt || now));
  const isPoor = score < Number(thresholdSlider.value);

  if (isPoor) {
    sessionStats.poorMs += elapsed;
    if (!sessionStats.wasPoor) {
      sessionStats.alertCount += 1;
      sessionStats.poorStreakStart = now;
    }
    sessionStats.longestPoorMs = Math.max(sessionStats.longestPoorMs, now - sessionStats.poorStreakStart);
  } else {
    sessionStats.goodMs += elapsed;
    sessionStats.poorStreakStart = 0;
  }

  sessionStats.wasPoor = isPoor;
  sessionStats.lastAt = now;
  renderSessionStats();
}

function renderSessionStats() {
  statGoodTime.textContent = formatDuration(sessionStats.goodMs);
  statBadTime.textContent = formatDuration(sessionStats.poorMs);
  statAlertCount.textContent = String(sessionStats.alertCount);
  statLongestPoor.textContent = formatDuration(sessionStats.longestPoorMs);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
setInterval(updateBreakReminder, 1000);

function resetBreakReminder() {
  breakStartedAt = Date.now();
  breakAlerted = false;
  saveState();
  updateBreakReminder();
}

function updateBreakReminder() {
  if (!breakStatus) return;

  if (breakToggle.value !== "on") {
    breakStatus.textContent = "Break reminders off";
    return;
  }

  const intervalMs = Number(breakSlider.value) * 60 * 1000;
  const elapsed = Date.now() - breakStartedAt;
  const remaining = intervalMs - elapsed;

  if (remaining <= 0) {
    breakStatus.textContent = "Break due now";
    if (!breakAlerted) {
      breakAlerted = true;
      alertPanel.className = "alert-panel warn";
      alertTitle.textContent = "Break due";
      alertCopy.textContent = "Stand, stretch, and look away from the screen for a short break.";
      cueText.textContent = "Break due. Reset the reminder after you return.";
      showToast("Break due: stand, stretch, and look away from the screen.", "warn");
      showBrowserNotification("Break due", "Stand, stretch, and look away from the screen.");
      saveState();
    }
    return;
  }

  breakStatus.textContent = `Next break in ${formatDuration(remaining)}`;
}
function exportSettings() {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state: getCurrentState() }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "ergovision-settings.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importSettings(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const state = parsed.state || parsed;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      loadSavedState();
      syncSettingsLabels();
      cueText.textContent = "Imported settings loaded.";
      if (lastMetrics) updateUi(lastMetrics);
    } catch (error) {
      alertPanel.className = "alert-panel bad";
      alertTitle.textContent = "Import failed";
      alertCopy.textContent = "Choose a valid ErgoVision settings JSON file.";
      console.error(error);
    } finally {
      importSettingsInput.value = "";
    }
  });
  reader.readAsText(file);
}
function maybeShowToast(score, message) {
  const threshold = Number(thresholdSlider.value);
  const isBelowThreshold = score < threshold;
  const now = performance.now();

  if (toastToggle.value !== "on" || !isBelowThreshold) {
    toastWasPoor = isBelowThreshold;
    toastBeganAt = 0;
    return;
  }

  if (!toastBeganAt) toastBeganAt = now;
  if (now - toastBeganAt < Number(delaySlider.value) * 1000) {
    toastWasPoor = true;
    return;
  }

  if (!toastWasPoor || now - lastToastAt > 15000) {
    showToast(message, severity(score));
    lastToastAt = now;
  }
  toastWasPoor = true;
}

function maybeShowBrowserNotification(score, message) {
  const threshold = Number(thresholdSlider.value);
  const isBelowThreshold = score < threshold;
  const now = performance.now();

  if (notificationToggle.value !== "on" || !isBelowThreshold) {
    notificationWasPoor = isBelowThreshold;
    notificationBeganAt = 0;
    return;
  }

  if (!notificationBeganAt) notificationBeganAt = now;
  if (now - notificationBeganAt < Number(delaySlider.value) * 1000) {
    notificationWasPoor = true;
    return;
  }

  if (!notificationWasPoor || now - lastNotificationAt > 30000) {
    showBrowserNotification("ErgoVision posture alert", message);
    lastNotificationAt = now;
  }
  notificationWasPoor = true;
}

function showBrowserNotification(title, body) {
  if (notificationToggle.value !== "on" || !("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "./favicon.svg",
    tag: "ergovision-posture",
    renotify: true,
  });
}

async function syncNotificationPermission() {
  if (notificationToggle.value !== "on") return;

  if (!("Notification" in window)) {
    notificationToggle.value = "off";
    cueText.textContent = "Browser notifications are not supported in this browser.";
    return;
  }

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  if (Notification.permission !== "granted") {
    notificationToggle.value = "off";
    cueText.textContent = "Browser notification permission was not granted.";
  }
}

function syncNotificationControl() {
  if (!("Notification" in window)) {
    notificationToggle.value = "off";
    notificationToggle.disabled = true;
    notificationToggle.title = "Browser notifications are not supported here.";
    return;
  }

  notificationToggle.disabled = false;
  notificationToggle.title = Notification.permission === "denied" ? "Notifications are blocked in browser settings." : "";
  if (Notification.permission === "denied") notificationToggle.value = "off";
}
function showToast(message, type = "warn") {
  if (!toastRegion || toastToggle?.value === "off") return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 5200);
}
