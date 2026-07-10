# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-flow.spec.js >> Quiz Flow >> quiz view shows questions after navigating from lesson
- Location: test\e2e\full-user-flow.spec.js:296:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - status "Loading Bayan" [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]: 📖
      - heading "Bayan" [level=1] [ref=e5]
      - paragraph [ref=e6]: Understand the Quran, one word at a time.
  - link "Skip to content" [ref=e9] [cursor=pointer]:
    - /url: "#content"
  - application "Bayan — Quran Learning App" [ref=e10]:
    - banner [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: بِسْمِ اللَّهِ
          - generic [ref=e15]: ✓ Offline ready
        - button "Account" [ref=e17] [cursor=pointer]:
          - generic [ref=e18]: 👤
      - status "Learning statistics" [ref=e20]:
        - generic [ref=e21]: Lesson 1 of 16
        - generic [ref=e22]: ·
        - generic [ref=e23]: "0"
        - generic [ref=e24]: Learned
        - generic [ref=e25]: ·
        - generic [ref=e26]: "0"
        - generic [ref=e27]: Due
        - generic [ref=e28]: ·
        - generic [ref=e29]: —
        - generic [ref=e30]: Quiz
        - progressbar "Daily review goal" [ref=e31] [cursor=pointer]:
          - img [ref=e32]:
            - generic [ref=e35]: "0"
      - progressbar "Session progress" [ref=e36]:
        - generic [ref=e38]: Word 1 / 20
    - main [ref=e39]:
      - region "Learning Dashboard"
    - navigation "Main navigation" [ref=e40]:
      - button "📚 Paths" [ref=e41] [cursor=pointer]:
        - generic [ref=e42]: 📚
        - generic [ref=e43]: Paths
      - button "📖 Learn" [ref=e44] [cursor=pointer]:
        - generic [ref=e45]: 📖
        - generic [ref=e46]: Learn
      - button "✏️ Quiz" [ref=e47] [cursor=pointer]:
        - generic [ref=e48]: ✏️
        - generic [ref=e49]: Quiz
      - button "📋 Words" [ref=e50] [cursor=pointer]:
        - generic [ref=e51]: 📋
        - generic [ref=e52]: Words
      - button "📊 Stats" [ref=e53] [cursor=pointer]:
        - generic [ref=e54]: 📊
        - generic [ref=e55]: Stats
      - button "📈 Analytics" [ref=e56] [cursor=pointer]:
        - generic [ref=e57]: 📈
        - generic [ref=e58]: Analytics
      - generic [ref=e59]: 📖Bayan
```