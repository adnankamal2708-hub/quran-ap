# Bayan — Understand the Quran, One Word at a Time

**Bayan** (بيان) is a modern Quran vocabulary learning platform that helps you understand the words of the Quran through spaced repetition, root analysis, morphological relationships, and contextual learning.

## Features

- **Foundation Course** — Master the 100 most frequent Quranic words across 10 progressive lessons (~84% of all Quranic word occurrences)
- **Learn by Surah** — Study vocabulary in Quranic context, surah by surah
- **Root Family Learning** — Explore Arabic morphology by studying words grouped by root letters
- **Adaptive Spaced Repetition (SRS)** — SM-2 algorithm with automatic review scheduling
- **Interactive Quiz System** — Multiple-choice quizzes with intelligent distractors
- **Vocabulary Explorer** — Comprehensive word reference with root families, derived forms, semantic groups, and morphological relationships
- **Quran Reading Coverage** — Track what percentage of Quranic vocabulary you've mastered
- **Offline-First PWA** — Study offline, sync when connected via Firebase
- **User Accounts** — Cloud sync across devices via Firebase Auth + Firestore
- **Analytics Dashboard** — Learning insights, trend tracking, achievements, and forecasts
- **Personal Notes** — Annotate words for contextual learning

## Architecture

```
├── index.html          — App shell (PWA entry point)
├── styles.css          — Global styles
├── manifest.json       — PWA manifest
├── sw.js              — Service worker for offline support
├── build.js           — Production build script (minification + bundling)
├── js/
│   ├── app.js         — Application bootstrap & orchestration
│   ├── ui.js          — UI rendering module
│   ├── data.js        — Vocabulary data model & constants
│   ├── vocabulary.js  — Word search, filtering, relationships engine
│   ├── srs.js         — SM-2 spaced repetition algorithm
│   ├── quiz.js        — Quiz system with intelligent distractors
│   ├── analytics.js   — Learning analytics & insights
│   ├── ux-polish.js   — Onboarding tour, toast system, milestones
│   ├── auth-ui.js     — Login/signup form handlers
│   ├── profile-ui.js  — Profile & settings UI
│   ├── data/          — Quranic vocabulary word files
│   └── services/      — Firebase auth, sync, and user services
├── test/              — Test suites
└── dist/              — Production build output
```

## Getting Started

1. **Development**: Open `index.html` in a browser (no build step required)
2. **Production Build**: `node build.js` — bundles app JS, minifies, generates service worker
3. **Run Tests**: `node test/run-all.js` — runs all test suites

## Tech Stack

- **Vanilla JS** — No framework dependencies
- **Firebase v12 Modular SDK** — Authentication, Firestore sync
- **PWA** — Service worker, offline caching, installable
- **SM-2 Algorithm** — Spaced repetition for optimal retention

## License

MIT
