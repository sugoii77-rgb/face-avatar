# Face Avatar

An interactive 3D face avatar built with Three.js.

- The portrait follows your mouse in all four directions
- With webcam permission it tracks your real face via MediaPipe (all processing stays in the browser)
- Blinks every 3 seconds
- Photo relief: drop any portrait at `assets/face-photo.jpg` and the engine rebuilds the depth map from it

## Run locally

Any static server works:

```bash
python -m http.server 8765
# open http://localhost:8765
```

## Tuning

All knobs live in `face-engine.html`:

| Setting | What it does |
|---|---|
| `PHOTO.centerU/V`, `zoom` | crop position / tightness on the source photo |
| `PHOTO.amp` | 3D relief depth (parallax strength) |
| `PHOTO.fit` | portrait size relative to viewport height |
| `BLINK.period`, `duration` | blink interval / speed (ms) |
| `BLINK.eyes`, `rx`, `ry` | eye positions and size in texture UV |
| `maxY`, `maxX`, `ease` | head turn range and follow speed |

Debug: append `?blink=hold` to freeze the eyes closed while tuning.

## Roadmap

- [ ] Text-to-speech with synced lip movement
- [ ] Voice input
