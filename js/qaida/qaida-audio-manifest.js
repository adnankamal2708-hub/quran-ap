// ═══════════════════════════════════════════════════════════════
// qaida-audio-manifest.js — Letter and mark recordings for the Qaida
//
// One entry per skill id (QAIDA_SKILL_IDS) that has a recording, naming a
// file in assets/audio/qaida/. Empty until recordings by a qualified
// teacher are added: each skill without an entry simply has no play
// button and no listening exercises, so adding a file plus a line here is
// all it takes to switch one on. Never add synthetic or AI voices.
// The Tajweed track appears once all 28 letters are listed. How to record
// them and name the files: docs/recording-letters.md.
//
//   ba: 'ba.mp3',
// ═══════════════════════════════════════════════════════════════

var QAIDA_AUDIO_MANIFEST = {};
