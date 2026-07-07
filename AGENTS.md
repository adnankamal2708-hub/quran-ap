# AGENTS.md

# Bayan — Quran Learning App

## Mission

This project helps users understand the Quran by teaching Quranic Arabic vocabulary in a structured, motivating, and scientifically effective way.

The app should always prioritize:

- Simplicity
- Accuracy
- Educational value
- Beautiful UX
- Maintainability
- Performance
- Offline-first design

---

# Tech Stack

- HTML
- CSS
- Vanilla JavaScript (ES6)
- Firebase v9 Modular SDK
- Firestore
- Firebase Authentication
- GitHub Pages
- Progressive Web App (PWA)

Avoid introducing frameworks unless there is a compelling long-term reason.

---

# Core Features

The application currently contains or will contain:

- Foundation Course
- Vocabulary lessons
- Review system
- Quiz engine
- Progress tracking
- XP system
- Streaks
- Surah learning
- User authentication
- Cloud synchronization
- Offline mode
- User profile
- Settings
- Analytics

Future additions should integrate cleanly into this architecture.

---

# Architectural Principles

Prefer:

- modular code
- reusable functions
- small files
- low coupling
- high cohesion

Avoid:

- duplicated logic
- large functions
- global mutable state
- hidden side effects

Never duplicate existing functionality.

Always reuse existing modules whenever possible.

---

# Data

All Quran vocabulary data should have a single source of truth.

Avoid hardcoded vocabulary.

Avoid duplicated datasets.

Keep lesson data separate from application logic.

---

# Firebase

Always use Firebase v9 Modular SDK.

Never introduce deprecated Firebase APIs.

Authentication must remain secure.

Do not modify Firestore schema without a migration plan.

Never expose secrets.

---

# PWA

Never break:

- offline support
- service worker
- caching
- installability
- update flow

Always preserve PWA functionality.

---

# UI

Maintain the current design language.

Mobile-first.

Responsive.

Accessible.

Fast.

Avoid unnecessary animations.

Keep interfaces clean and distraction-free.

---

# Performance

Minimize:

- DOM updates
- unnecessary re-renders
- repeated calculations
- repeated Firebase reads

Prefer caching where appropriate.

Lazy-load large resources.

---

# Code Style

Prefer:

- descriptive names
- early returns
- pure functions
- async/await
- reusable utilities

Avoid:

- deeply nested logic
- magic numbers
- duplicated constants

---

# Foundation Course

The Foundation Course is one of the highest-priority parts of the application.

Changes must preserve:

- lesson order
- completion tracking
- quizzes
- review integration
- user progress
- analytics

Never regress user progress.

---

# Quiz Engine

Questions must remain:

- deterministic
- fair
- educational

Never generate impossible or misleading questions.

---

# Progress System

Progress tracking is critical.

Always preserve:

- XP
- streaks
- completed lessons
- review history
- mastery calculations

Never reset user progress unless explicitly requested.

---

# Security

Never weaken authentication.

Never expose API keys.

Never remove validation.

Never bypass authorization.

---

# Refactoring

When refactoring:

Preserve behaviour.

Reduce complexity.

Improve readability.

Do not perform unnecessary rewrites.

Large refactors should be split into smaller commits.

---

# Before Writing Code

Always:

1. Read the affected files.
2. Understand existing architecture.
3. Explain the plan.
4. Minimize changes.
5. Preserve backwards compatibility.

---

# Testing

After every change:

- check syntax
- verify existing functionality
- identify edge cases
- recommend manual tests

Never assume code works without verification.

---

# Git

One logical change per commit.

Do not modify unrelated files.

Keep commits small and reviewable.

---

# Documentation

If architecture changes:

Update documentation.

Keep comments concise.

Document complex algorithms.

---

# General Rule

When multiple solutions exist:

Choose the solution that is:

- simpler
- more maintainable
- easier to extend
- easier to test
- less likely to introduce bugs

Optimize for the long-term health of the project rather than the shortest implementation.