#!/usr/bin/env node
/**
 * recorder.test.js — Unit tests for the on-device recorder
 *
 * Tests: support detection, denied and unsupported starts, the recording
 * URL, revoking the old URL, stopping the mic tracks, replacing a running
 * recording, discarding, and the reference-then-recording comparison.
 *
 * Run: node test/recorder.test.js
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

function load(rel) { (0, eval)(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }

var played = [];
global.playAudio = function (url, onEnd) { played.push({ url: url, onEnd: onEnd }); return Promise.resolve(true); };
global.stopAudio = function () {};
load('js/services/recorder.js');

var passed = 0;
var failed = 0;
var queue = Promise.resolve();

function test(name, fn) {
  queue = queue.then(fn).then(function () {
    passed++;
    console.log('  ✅ ' + name);
  }, function (e) {
    failed++;
    console.log('  ❌ ' + name);
    console.log('     ' + (e.message || e));
  });
}

// ── Stubs ──
var getUserMediaCalls, streams, recorders, revoked, urlCount, denyMic;

function resetStubs() {
  getUserMediaCalls = 0; streams = []; recorders = []; revoked = []; urlCount = 0; denyMic = false;
  Object.defineProperty(global, 'navigator', { configurable: true, writable: true, value: { mediaDevices: { getUserMedia: function () {
    getUserMediaCalls++;
    if (denyMic) return Promise.reject(new Error('NotAllowedError'));
    var stream = { stopped: 0, getTracks: function () {
      var s = this;
      return [{ stop: function () { s.stopped++; } }, { stop: function () { s.stopped++; } }];
    } };
    streams.push(stream);
    return Promise.resolve(stream);
  } } } });
  global.MediaRecorder = function (stream, opts) {
    this.stream = stream; this.opts = opts; this.state = 'inactive'; this.mimeType = (opts && opts.mimeType) || 'audio/x-default';
    recorders.push(this);
    this.start = function () { this.state = 'recording'; };
    this.stop = function () {
      this.state = 'inactive';
      if (this.ondataavailable) this.ondataavailable({ data: { size: 3 } });
      if (this.onstop) this.onstop();
    };
  };
  global.MediaRecorder.isTypeSupported = function (t) { return t === 'audio/webm'; };
  global.Blob = function (parts, opts) { this.parts = parts; this.type = opts && opts.type; };
  global.URL = { createObjectURL: function () { return 'blob:rec-' + (++urlCount); }, revokeObjectURL: function (u) { revoked.push(u); } };
}

console.log('\n📋 Recorder');

test('unsupported browsers get "unsupported" and never ask for the microphone', async function () {
  resetStubs();
  delete global.MediaRecorder;
  assert.strictEqual(isRecordingSupported(), false);
  assert.strictEqual(await startRecording(), 'unsupported');
  assert.strictEqual(getUserMediaCalls, 0);
});

test('a refused microphone gives "denied"', async function () {
  resetStubs();
  denyMic = true;
  assert.strictEqual(isRecordingSupported(), true);
  assert.strictEqual(await startRecording(), 'denied');
  assert.strictEqual(getRecordingUrl(), null);
});

test('start then stop gives an object URL, prefers webm and releases the mic', async function () {
  resetStubs();
  assert.strictEqual(await startRecording(), 'recording');
  assert.strictEqual(recorders[0].opts.mimeType, 'audio/webm');
  var url = await stopRecording();
  assert.strictEqual(url, 'blob:rec-1');
  assert.strictEqual(getRecordingUrl(), url);
  assert.strictEqual(streams[0].stopped, 2, 'every track stopped');
  discardRecording();
});

test('without a supported type the browser default is used', async function () {
  resetStubs();
  global.MediaRecorder.isTypeSupported = function () { return false; };
  await startRecording();
  assert.strictEqual(recorders[0].opts, undefined);
  await stopRecording();
  discardRecording();
});

test('recording again revokes the previous URL', async function () {
  resetStubs();
  await startRecording();
  var first = await stopRecording();
  await startRecording();
  var second = await stopRecording();
  assert.notStrictEqual(first, second);
  assert.deepStrictEqual(revoked, [first]);
  discardRecording();
});

test('starting while recording stops the old recording and its mic first', async function () {
  resetStubs();
  await startRecording();
  await startRecording();
  assert.strictEqual(recorders[0].state, 'inactive');
  assert.strictEqual(streams[0].stopped, 2);
  assert.strictEqual(recorders[1].state, 'recording');
  assert.strictEqual(await stopRecording(), 'blob:rec-1', 'only the second take becomes a URL');
  assert.deepStrictEqual(revoked, []);
  discardRecording();
});

test('stopping with nothing recording gives null', async function () {
  resetStubs();
  assert.strictEqual(await stopRecording(), null);
});

test('discardRecording revokes the URL and clears it', async function () {
  resetStubs();
  await startRecording();
  var url = await stopRecording();
  discardRecording();
  assert.deepStrictEqual(revoked, [url]);
  assert.strictEqual(getRecordingUrl(), null);
});

test('playComparison plays the reference, then the recording from its onEnd', async function () {
  resetStubs();
  await startRecording();
  var url = await stopRecording();
  played.length = 0;
  var done = 0;
  playComparison('ref.mp3', function () { done++; });
  assert.strictEqual(played.length, 1);
  assert.strictEqual(played[0].url, 'ref.mp3');
  played[0].onEnd();
  assert.strictEqual(played.length, 2);
  assert.strictEqual(played[1].url, url);
  assert.strictEqual(done, 0);
  played[1].onEnd();
  assert.strictEqual(done, 1);
  discardRecording();
});

test('playComparison without a recording plays only the reference', async function () {
  resetStubs();
  played.length = 0;
  var done = 0;
  playComparison('ref.mp3', function () { done++; });
  played[0].onEnd();
  assert.strictEqual(played.length, 1);
  assert.strictEqual(done, 1);
});

queue.then(function () {
  console.log('\n' + '='.repeat(50));
  console.log('  recorder.test.js');
  console.log('  Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
});
