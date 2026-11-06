# Recording the letter sounds

The Tajweed track appears in the app once all 28 letters below have a recording. Each file also switches on that letter's audio in Qaida straight away. Use your own voice only: no synthetic or AI voices.

## What to record

Say each letter in the form hamza + fatha, the letter, then sukun (for example ba is أَبْ), about 1 second each. The hamza (ء) is optional and not needed for release.

| Letter id | Arabic | File name |
|---|---|---|
| alif | أَاْ | alif.mp3 |
| ba | أَبْ | ba.mp3 |
| ta | أَتْ | ta.mp3 |
| tha | أَثْ | tha.mp3 |
| jim | أَجْ | jim.mp3 |
| hha | أَحْ | hha.mp3 |
| kha | أَخْ | kha.mp3 |
| dal | أَدْ | dal.mp3 |
| dhal | أَذْ | dhal.mp3 |
| ra | أَرْ | ra.mp3 |
| zay | أَزْ | zay.mp3 |
| sin | أَسْ | sin.mp3 |
| shin | أَشْ | shin.mp3 |
| sad | أَصْ | sad.mp3 |
| dad | أَضْ | dad.mp3 |
| tta | أَطْ | tta.mp3 |
| zza | أَظْ | zza.mp3 |
| ain | أَعْ | ain.mp3 |
| ghayn | أَغْ | ghayn.mp3 |
| fa | أَفْ | fa.mp3 |
| qaf | أَقْ | qaf.mp3 |
| kaf | أَكْ | kaf.mp3 |
| lam | أَلْ | lam.mp3 |
| mim | أَمْ | mim.mp3 |
| nun | أَنْ | nun.mp3 |
| ha | أَهْ | ha.mp3 |
| waw | أَوْ | waw.mp3 |
| ya | أَيْ | ya.mp3 |
| hamza (optional) | أَءْ | hamza.mp3 |

For alif, say a held "aa": alif is heard as a long vowel, not as a consonant.

## Format

- Mono MP3 or M4A, one letter per file, about 1 second each.
- A quiet room, the phone close to your mouth, no background noise, and a short pause before and after the sound.
- Keep the same distance and volume for all letters.

## Adding the files

1. Put the files in `assets/audio/qaida/`.
2. Add one line per letter inside the braces of `var QAIDA_AUDIO_MANIFEST = { ... }` in `js/qaida/qaida-audio-manifest.js`, for example:

```js
var QAIDA_AUDIO_MANIFEST = {
  ba: 'ba.mp3',
};
```

   The name must be the file's real name: an M4A file needs `ba: 'ba.m4a',`.
3. Run `npm run build`. Once all 28 letters are listed, the Tajweed track appears.
