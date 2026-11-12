# Film rig

An opt-in way to render a vertical short from this town. The viewer (`index.html`, `src/main.js`) never loads it. Open the film page on its own:

```
npm run dev
# http://127.0.0.1:5173/film/index.html?film=last-bus
```

`?play=1` previews the timeline in real time. A capture does not use that loop. `window.__film.renderFrame(i)` seeks to frame `i` and draws it once.

## Render Last Bus

1080×1920, 30 fps, 36 seconds (1080 frames). Needs Node, ffmpeg, and Chrome. `playwright-core` drives the system Chrome (SwiftShader), the same way `SKILLS.md` drives the viewer.

```bash
npm install
npm run dev          # leave this running

npm run film:audio -- /tmp/last-bus.wav
npm run film -- --url "http://127.0.0.1:5173/film/index.html?film=last-bus" --out /tmp/last-bus-frames
npm run film:assemble -- /tmp/last-bus-frames /tmp/last-bus.wav film/last-bus/out/last-bus.mp4
```

Beat stills only (one frame per shot, plus the 0.5s hook and the 0:22 reveal):

```bash
npm run film -- --stills --url "http://127.0.0.1:5173/film/index.html?film=last-bus" --out /tmp/last-bus-stills
```

`npm run film` with no `--url` starts Vite itself. Chrome is `/usr/local/bin/google-chrome` unless `CHROME_PATH` is set. Flags: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.

The assemble script is two-pass `loudnorm` (target −14 LUFS integrated, true peak −1.5 dBTP), then H.264 `yuv420p`, AAC, `+faststart`.

Check the file:

```bash
ffprobe -hide_banner film/last-bus/out/last-bus.mp4
ffmpeg -i film/last-bus/out/last-bus.mp4 -af loudnorm=print_format=json -f null -
```

## What a frame is

Time is `frame / 30`. Nothing uses the wall clock. Rain is seeded (`mulberry32`). The bus position is a pure function of time (`film/last-bus/timing.js`), the same function the soundtrack uses, so the splash lines up with the cut. Shot 3 averages 6 subframes across a 2/30 s shutter for motion blur. Subframe times are clamped inside the shot, so a cut frame never shows the next camera.

The picture is the existing PS1 step (pixel size 2, 15-bit dither, outlines) drawn into a target, then a grade: cold shadows, warm highlights, bloom on the lamp and the lights, vignette, grain. No depth of field, no letterbox. The film page has no HUD.

Frames 1072–1079 are black. That is the only cut to black.

## Focal length

three.js `PerspectiveCamera.fov` is the **vertical** field of view. For a portrait frame the full-frame sensor is turned on its side, so the vertical sensor height is **36 mm** (the landscape long side), not 24 mm.

```
vertical FOV = 2 * atan(36 / (2 * focalLength))
```

`film/rig/camera.js` (`verticalFovDeg`) does this. Horizontal FOV follows the 9:16 frame (`1080 / 1920`):

```
horizontal FOV = 2 * atan(tan(verticalFOV / 2) * (1080 / 1920))
```

| Focal | Vertical FOV | Horizontal FOV |
|---|---|---|
| 24 mm | 73.74° | 45.75° |
| 28 mm | 65.47° | 39.76° |
| 35 mm | 54.43° | 32.27° |
| 50 mm | 39.60° | 22.90° |
| 85 mm | 23.91° | 13.59° |
| 100 mm | 20.41° | 11.56° |

## Shot format

A short is a list of shots. `film/rig/timeline.js` picks the shot with `start <= t < end`.

A declarative shot:

```js
{
  id: '1-wide',
  start: 0,          // seconds
  end: 3,
  focal: 24,         // mm, converted as above
  ease: 'smooth',    // linear | smooth | out | in  (film/rig/ease.js)
  from: [x, y, z],   // eye at the start
  to: [x, y, z],     // eye at the end; omit to lock the camera
  look: [x, y, z],
  lookTo: [x, y, z],
  near: 0.15,
  subframes: 6,      // optional: average this many dithered frames
  shutter: 2 / 30,   // optional: how far those samples spread, in seconds
}
```

A shot can instead set `camera(stage, u, cam, t)` when the move has to follow something (the bus). `u` is 0..1 inside the shot, before easing.

Safe zones for 1080×1920, measured from the top left: keep the important action out of the top 220 px, the bottom 420 px, and the right 140 px. `stage.project(camera)` returns pixel positions for the feet, the head, the kitten, the bus and the stick.

## Layout

```
film/index.html            the page (a canvas, no UI)
film/main.js               seek, grade, window.__film
film/rig/camera.js         focal length → vertical FOV
film/rig/timeline.js       which shot is active
film/rig/ease.js
film/rig/rain.js           seeded world rain + a screen veil
film/rig/present.js        PS1 target, bloom, grade, motion-blur accumulate
film/last-bus/timing.js    the clock the picture and the audio share
film/last-bus/stage.js     the street, the characters, the bus
film/last-bus/shots.js     the eight shots
film/last-bus/audio.js     the synthesized soundtrack
film/last-bus/CREDITS.md
scripts/film-render.js
scripts/film-assemble.sh
```

To add another short, add a folder beside `last-bus/` with its own `timing.js`, `stage.js`, `shots.js` and `audio.js`, and a branch in `film/main.js` for its `?film=` id. The rig (`film/rig/`, the render script, the assemble script) stays shared.

## Sound

`film/last-bus/audio.js` writes a 48 kHz stereo wav: rain, the bus, the splash, and a sparse piano. It is all synthesis. Sources and the license line are in `film/last-bus/CREDITS.md`. The splash energy peaks at the shot 3 cut (t = 10 s). The piano enters during shot 1, stops before that cut, and comes back as the kitten is found. Rain ducks a little under the piano and is the only bed in shot 4.
