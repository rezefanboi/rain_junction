# Production Assets Directory Structure

This directory is organized for a high-performance production-ready web application or game. Below is the structure and configuration guide for audio, video, and image assets.

## Directory Layout

```
assets/
├── audio/
│   ├── ambient/       # Looping environmental background sounds (rain, wind, thunder)
│   ├── sfx/           # One-shot sound effects (footsteps, puddles splashes, UI clicks)
│   └── music/         # Dynamic or static background music/soundtracks
├── video/             # Video backdrops or cutscenes
└── images/            # UI icons, spritesheets, textures, and background images
```

---

## 1. Audio Assets (`assets/audio/`)

### Recommended Formats
* **Primary (Web & Compatibility):** `.mp3` (MPEG-3) or `.m4a` (AAC) - broad compatibility, excellent compression.
* **Secondary (Modern Web/High Quality):** `.ogg` (Vorbis/Opus) - best for seamless looping (MP3 adds a tiny silence gap at the start/end).
* **Sound Effects (Short duration):** `.wav` - uncompressed, low-latency decoding for rapid playback.

### Structure

#### A. Ambient Loops (`assets/audio/ambient/`)
Designed for continuous background playback. Ensure files are cut exactly on zero-crossings to prevent clicks when looping.
* `rain_loop.ogg` - Gentle constant rain background.
* `wind_loop.ogg` - Soft low-frequency wind blowing.

#### B. Sound Effects (`assets/audio/sfx/`)
Short, one-shot audio assets.
* `footstep_soft.wav` / `footstep_wet.wav` - Character walking sounds.
* `splash_car.wav` - Water splashing from vehicles.
* `thunder_rumble.wav` - Dynamic occasional thunder.
* `button_click.wav` - UI button feedback.

#### C. Music (`assets/audio/music/`)
Background score tracks.
* `main_theme.mp3` - Gentle walking background music track.

---

## 2. Video Assets (`assets/video/`)

* **Formats:** `.mp4` (H.264/AAC for universal support) and `.webm` (VP9 for high quality / transparency / low file size).
* **Recommended usage:**
  - Keep bitrate low (under 1.5 Mbps for 1080p, or under 800 Kbps for 720p).
  - Use the `muted autoplay loop playsinline` attributes in HTML5 `<video>` tags for background loops.

---

## 3. Image Assets (`assets/images/`)

* **Formats:** `.webp` (default for web due to superior compression), `.svg` (for vector UI icons), `.png` (for spritesheets requiring alpha transparency).
