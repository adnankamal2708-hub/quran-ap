// ═══════════════════════════════════════════════════════════════
// recorder.js — Record the learner's voice on this device
//
// One take at a time, kept in memory and played back through an object
// URL so the learner can compare it with the reference recitation.
// Nothing is saved or sent anywhere. The microphone is requested only
// when recording starts and released as soon as it stops.
// ═══════════════════════════════════════════════════════════════

var RECORDING_TYPES = ['audio/webm', 'audio/mp4'];

var _recorder = null;
var _micStream = null;
var _chunks = [];
var _recordingUrl = null;

function isRecordingSupported() {
  return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';
}

function _recorderOptions() {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  for (var i = 0; i < RECORDING_TYPES.length; i++) {
    if (MediaRecorder.isTypeSupported(RECORDING_TYPES[i])) return { mimeType: RECORDING_TYPES[i] };
  }
  return undefined;
}

function _releaseMic() {
  if (_micStream) _micStream.getTracks().forEach(function (track) { track.stop(); });
  _micStream = null;
}

/** Abandon a running take without keeping it. */
function _abandonRecorder() {
  if (_recorder) {
    _recorder.ondataavailable = null;
    _recorder.onstop = null;
    if (_recorder.state !== 'inactive') _recorder.stop();
  }
  _recorder = null;
  _chunks = [];
  _releaseMic();
}

/**
 * Ask for the microphone and start recording, replacing any running take.
 * @returns {Promise<'recording'|'denied'|'unsupported'>}
 */
function startRecording() {
  if (!isRecordingSupported()) return Promise.resolve('unsupported');
  _abandonRecorder();
  return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    _micStream = stream;
    _chunks = [];
    var options = _recorderOptions();
    _recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
    _recorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) _chunks.push(e.data); };
    _recorder.start();
    return 'recording';
  }, function () { return 'denied'; });
}

/**
 * Stop recording and release the microphone.
 * @returns {Promise<string|null>} an object URL for the take, or null if nothing was recording
 */
function stopRecording() {
  var recorder = _recorder;
  if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
  return new Promise(function (resolve) {
    recorder.onstop = function () {
      var blob = new Blob(_chunks, { type: recorder.mimeType });
      _abandonRecorder();
      if (_recordingUrl) URL.revokeObjectURL(_recordingUrl);
      _recordingUrl = URL.createObjectURL(blob);
      resolve(_recordingUrl);
    };
    recorder.stop();
  });
}

function getRecordingUrl() {
  return _recordingUrl;
}

/**
 * Play the reference, then the learner's take (just the reference if there
 * is no take).
 * @param {string} referenceUrl
 * @param {Function} [onDone]
 */
function playComparison(referenceUrl, onDone) {
  var takeUrl = _recordingUrl;
  playAudio(referenceUrl, function () {
    if (takeUrl) playAudio(takeUrl, onDone);
    else if (onDone) onDone();
  });
}

function discardRecording() {
  _abandonRecorder();
  if (_recordingUrl) URL.revokeObjectURL(_recordingUrl);
  _recordingUrl = null;
}
