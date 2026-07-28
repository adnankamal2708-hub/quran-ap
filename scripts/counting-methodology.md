# Bayan Quran Vocabulary — Counting Methodology Specification

## What Constitutes One Occurrence?

**Definition:** One occurrence of a vocabulary word is recorded when the
word's canonical normalized form appears as an independent token in the
Uthmani Quran text (source: `js/quran/quran-data.js`, CC-BY-SA 4.0).

## Tokenization Rules

1. The Quran text is split into tokens by whitespace.
2. Each whitespace-delimited segment is one token.
3. Quranic annotation symbols (۞, ۩, etc.) are treated as part of the
   surrounding token if not whitespace-separated, and are stripped during
   normalization.

## Normalization Pipeline

Every token and every vocabulary word passes through the same normalization
before comparison:

| Step | Operation | Unicode Range |
|------|-----------|---------------|
| 1 | Strip tatweel (kashida) | U+0640 |
| 2 | Strip all Arabic diacritics (tashkeel): Fatha, Kasra, Damma, Shadda, Sukun, Tanwin, Maddah, etc. | U+064B–U+065F, U+0610–U+061A |
| 3 | Strip Quranic annotation marks | U+06D6–U+06ED |
| 4 | Strip verse brackets | U+FD3E, U+FD3F |
| 5 | Normalize alif with wasla (ٱ) → bare alif (ا) | U+0671 → U+0627 |
| 6 | Normalize hamza-above alif (أ) → bare alif (ا) | U+0623 → U+0627 |
| 7 | Normalize hamza-below alif (إ) → bare alif (ا) | U+0625 → U+0627 |
| 8 | Normalize alif with madd (آ) → bare alif (ا) | U+0622 → U+0627 |
| 9 | Normalize dagger alif (ٰ) → bare alif (ا) | U+0670 → U+0627 |
| 10 | Normalize teh marbuta (ة) → heh (ه) | U+0629 → U+0647 |
| 11 | Normalize alif maqsurah (ى) → ya (ي) | U+0649 → U+064A |
| 12 | Normalize hamza on waw (ؤ) → waw (و) | U+0624 → U+0648 |
| 13 | Normalize hamza on ya (ئ) → ya (ي) | U+0626 → U+064A |
| 14 | Normalize small waw (ۥ) → waw (و) | U+06E5 → U+0648 |
| 15 | Normalize small yeh (ۦ) → ya (ي) | U+06E6 → U+064A |
| 16 | Collapse whitespace and trim | |

## Matching Rules

1. A vocabulary word's `arabic` field is normalized using the pipeline above.
2. A Quran token is normalized using the same pipeline.
3. The two normalized forms are compared with exact string equality.
4. If they match, the vocabulary word gets +1 occurrence for that token.
5. If they don't match, the vocabulary word does NOT get an occurrence for
   that token (no fuzzy matching, no prefix stripping, no suffix stripping).

## What Is NOT Counted

The following are NOT counted as occurrences:

- **Multi-word phrases**: Vocabulary entries containing spaces (e.g.,
  "قُلْ هُوَ اللَّهُ أَحَدٌ") are never matched against single tokens. These
  represent full verses or phrases, not individual words.
- **Morphological variants**: A word form with a prefix (e.g., "وَقَالَ")
  is a DIFFERENT token from the bare form ("قَالَ"). They do not match
  each other. The vocabulary must explicitly list each desired surface form.
- **Suffix variants**: Similarly, "قَالُوا" (they said) is a different token
  from "قَالَ" (he said) and does not match.
- **Lemma counting**: The system counts SURFACE FORMS, not lemmas. "قَالَ"
  is counted separately from "قَالُوا", "يَقُولُ", "قُلْ", etc.

## Why Prefix/Suffix Stripping Is NOT Applied

Arabic prefixes (و, ف, ب, ل, ك, س) and suffixes (pronominal, verbal, nominal)
can be identical to root letters. Aggressive stripping would produce false
positive matches. For example:
- Stripping و from وَعَدَ (promise, where و is a root letter) would
  incorrectly match عَدَ, which is not a vocabulary word.
- Stripping ك from كَانَ (was, where ك is a root letter) would incorrectly
  match ان, matching a completely different word.

To avoid false positives, the matching is exact (after normalization).
Words with prefixes in the Quran corpus that the vocabulary wants to match
must be explicitly added to the vocabulary dataset.

## Coverage Calculation

Coverage = (matched tokens / total Quran tokens) × 100%

Where:
- **matched tokens** = tokens in the Quran corpus whose normalized form
  matches at least one vocabulary word's normalized form
- **total Quran tokens** = 77,429 (all whitespace-delimited tokens across
  all 114 surahs, 6,236 verses)
- **Vocabulary scope** = canonical word forms only (deduplicated by
  normalized Arabic text)

## Current Statistics (from validation)

| Metric | Value |
|--------|-------|
| Total Quran tokens | 77,429 |
| Canonical vocabulary forms | ~850 |
| Matched tokens (exact after normalization) | ~18,882 |
| Current coverage | ~24.39% |
| Upper bound (with aggressive prefix stripping) | ~37.78% |
| Claimed old coverage | ~84.91% |

## Limitations

1. **Vocabulary coverage is limited by vocabulary size**: To reach 84%
   coverage, the vocabulary would need to cover far more tokens — likely
   2,000–3,000 canonical word forms instead of ~850.
2. **Morphological variation requires explicit entries**: The vocabulary
   must list each desired surface form. Prefix and suffix variants of the
   same root are separate tokens in the Quran.
3. **The ~84% claim was based on inflated manually-entered counts**, not
   corpus-derived data. It was never accurate.
4. **Future vocabulary additions** should be added to the appropriate
   `words-*.js` file and will automatically receive correct occurrence
   counts when the rebuild script is run.

## Recommendation

1. Adopt the exact-match-after-normalization methodology as the single
   source of truth.
2. Update all vocabulary files with corpus-derived occurrence counts.
3. Recalculate Foundation Course ordering based on new counts.
4. Update the coverage/comprehension educational claims to match reality.
5. Add the rebuild script to the CI pipeline for ongoing validation.
6. Consider expanding the vocabulary dataset if higher coverage is desired.
