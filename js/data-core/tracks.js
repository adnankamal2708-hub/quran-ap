// ── Learning Tracks ──────────────────────────────────────────────
// Which tracks a learner joined, their main track, per-track level (0..3)
// and the highest share of the Quran they have reached in each track.
// Stored under TRACKS_KEY as JSON and synced as the `tracks` field.
//
// Shape: { version, main, startFromZero, updatedAt,
//          tracks: { <id>: { joined, level, percentHigh,
//                            placementAttempts, updatedAt } } }
//
// Level and percentage only ever grow, so leaving and rejoining a track
// restores them. A learner with no saved state is on 'words' (their
// existing progress is untouched — this module never writes other keys).

/** Track ids, in display order */
var TRACK_IDS = ['qaida', 'tajweed', 'words', 'understanding'];

/** Levels per track: 0..TRACK_LEVEL_COUNT - 1 */
var TRACK_LEVEL_COUNT = 4;

/** localStorage key (also the cloud-synced `tracks` field) */
var TRACKS_KEY = 'quran_tracks';

var TRACKS_STATE_VERSION = 1;
var DEFAULT_TRACK_ID = 'words';

/** Tracks a learner may join. Phase 1 ships only the words track. */
function isTrackReleased(id) {
  return id === 'words';
}

function isKnownTrack(id) {
  return TRACK_IDS.indexOf(id) >= 0;
}

function toNonNegativeNumber(value) {
  return (typeof value === 'number' && isFinite(value) && value > 0) ? value : 0;
}

function normalizeTrackRecord(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    joined: raw.joined === true,
    level: Math.min(TRACK_LEVEL_COUNT - 1, Math.floor(toNonNegativeNumber(raw.level))),
    percentHigh: Math.min(100, toNonNegativeNumber(raw.percentHigh)),
    placementAttempts: Math.floor(toNonNegativeNumber(raw.placementAttempts)),
    updatedAt: toNonNegativeNumber(raw.updatedAt),
  };
}

function firstJoinedTrackId(tracks) {
  for (var i = 0; i < TRACK_IDS.length; i++) {
    if (tracks[TRACK_IDS[i]].joined) return TRACK_IDS[i];
  }
  return null;
}

/**
 * Coerce anything (missing, corrupt, from an older or newer build) into a
 * valid TrackState: every known track present, at least one joined, and
 * `main` always a joined track.
 */
function normalizeTrackState(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  var rawTracks = raw.tracks && typeof raw.tracks === 'object' ? raw.tracks : {};
  var tracks = {};
  TRACK_IDS.forEach(function(id) { tracks[id] = normalizeTrackRecord(rawTracks[id]); });

  var firstJoined = firstJoinedTrackId(tracks);
  if (!firstJoined) {
    tracks[DEFAULT_TRACK_ID].joined = true;
    firstJoined = DEFAULT_TRACK_ID;
  }

  var main = isKnownTrack(raw.main) && tracks[raw.main].joined ? raw.main : firstJoined;
  return {
    version: TRACKS_STATE_VERSION,
    main: main,
    startFromZero: raw.startFromZero === true,
    updatedAt: toNonNegativeNumber(raw.updatedAt),
    tracks: tracks,
  };
}

function loadTracks() {
  try {
    var raw = localStorage.getItem(TRACKS_KEY);
    return normalizeTrackState(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return normalizeTrackState(null);
  }
}

/**
 * Save, stamping the touched track and, when the learner changed a choice
 * (join, leave, main track, start-from-zero), the top level. Progress
 * writes leave the top-level stamp alone: it decides membership in
 * mergeTrackState, so progress on one device must not undo a choice made
 * later on another.
 */
function saveTracks(state, touchedId, choiceChanged) {
  var now = Date.now();
  if (choiceChanged) state.updatedAt = now;
  if (touchedId) state.tracks[touchedId].updatedAt = now;
  try {
    localStorage.setItem(TRACKS_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save tracks:', e.message);
  }
}

/**
 * Ask for a cloud sync after a change the learner made (join, leave, main
 * track, level, start-from-zero), as other progress writes do. Not called
 * for the percentage high-water mark, which moves too often.
 */
function queueTracksSync() {
  var user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  var sync = typeof window !== 'undefined' ? window.__sync : null;
  if (user && sync && sync.queueSync) sync.queueSync(user.uid);
}

function getMainTrackId() {
  return loadTracks().main;
}

/** Joined track ids: the main track first, then TRACK_IDS order. */
function getJoinedTrackIds() {
  var state = loadTracks();
  var rest = TRACK_IDS.filter(function(id) {
    return state.tracks[id].joined && id !== state.main;
  });
  return [state.main].concat(rest);
}

function joinTrack(id) {
  if (!isKnownTrack(id) || !isTrackReleased(id)) return false;
  var state = loadTracks();
  if (state.tracks[id].joined) return true;
  state.tracks[id].joined = true;
  saveTracks(state, id, true);
  queueTracksSync();
  return true;
}

function leaveTrack(id) {
  if (!isKnownTrack(id)) return false;
  var state = loadTracks();
  if (!state.tracks[id].joined) return false;
  state.tracks[id].joined = false;
  var remaining = firstJoinedTrackId(state.tracks);
  if (!remaining) return false;
  if (state.main === id) state.main = remaining;
  saveTracks(state, id, true);
  queueTracksSync();
  return true;
}

function setMainTrack(id) {
  if (!isKnownTrack(id)) return false;
  var state = loadTracks();
  if (!state.tracks[id].joined) return false;
  if (state.main === id) return true;
  state.main = id;
  saveTracks(state, null, true);
  queueTracksSync();
  return true;
}

function getTrackLevel(id) {
  return isKnownTrack(id) ? loadTracks().tracks[id].level : 0;
}

/** Raise a track's level. Returns true only if the level went up. */
function raiseTrackLevel(id, level) {
  if (!isKnownTrack(id)) return false;
  if (typeof level !== 'number' || Math.floor(level) !== level) return false;
  if (level < 0 || level >= TRACK_LEVEL_COUNT) return false;
  var state = loadTracks();
  if (level <= state.tracks[id].level) return false;
  state.tracks[id].level = level;
  saveTracks(state, id);
  queueTracksSync();
  return true;
}

function getTrackPercent(id) {
  return isKnownTrack(id) ? loadTracks().tracks[id].percentHigh : 0;
}

/**
 * Record the share of the Quran reached in a track (0..100). The stored
 * high-water mark only grows; `gained` is the increase, rounded to 0.1.
 */
function recordTrackPercent(id, percent) {
  if (!isKnownTrack(id)) return { percent: 0, gained: 0 };
  var state = loadTracks();
  var current = state.tracks[id].percentHigh;
  if (typeof percent !== 'number' || !isFinite(percent) || percent <= current) {
    return { percent: current, gained: 0 };
  }
  var next = Math.min(100, percent);
  state.tracks[id].percentHigh = next;
  saveTracks(state, id);
  return { percent: next, gained: Math.round((next - current) * 10) / 10 };
}

function isStartFromZero() {
  return loadTracks().startFromZero;
}

function setStartFromZero(on) {
  var state = loadTracks();
  state.startFromZero = !!on;
  saveTracks(state, null, true);
  queueTracksSync();
}

/** Placement attempts so far for a track; returns the count, then increments it. */
function nextPlacementAttempt(id) {
  if (!isKnownTrack(id)) return 0;
  var state = loadTracks();
  var attempt = state.tracks[id].placementAttempts;
  state.tracks[id].placementAttempts = attempt + 1;
  saveTracks(state, id);
  return attempt;
}

/**
 * Merge two TrackStates (local and cloud). Membership, main track and
 * start-from-zero follow the side with the higher top-level updatedAt
 * (local on ties); level, percentage and placement attempts take the
 * higher value so progress is never lost.
 */
function mergeTrackState(local, cloud) {
  if (!local && !cloud) return normalizeTrackState(null);
  if (!local) return normalizeTrackState(cloud);
  if (!cloud) return normalizeTrackState(local);

  var a = normalizeTrackState(local);
  var b = normalizeTrackState(cloud);
  var newer = b.updatedAt > a.updatedAt ? b : a;
  var tracks = {};
  TRACK_IDS.forEach(function(id) {
    tracks[id] = {
      joined: newer.tracks[id].joined,
      level: Math.max(a.tracks[id].level, b.tracks[id].level),
      percentHigh: Math.max(a.tracks[id].percentHigh, b.tracks[id].percentHigh),
      placementAttempts: Math.max(a.tracks[id].placementAttempts, b.tracks[id].placementAttempts),
      updatedAt: Math.max(a.tracks[id].updatedAt, b.tracks[id].updatedAt),
    };
  });
  return normalizeTrackState({
    main: newer.main,
    startFromZero: newer.startFromZero,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    tracks: tracks,
  });
}
