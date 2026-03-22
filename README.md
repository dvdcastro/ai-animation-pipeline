# AI Animation Pipeline

Generate game-ready sprite sheets using AI image generation.

## Architecture

- **Character Generation** — Nano Banana Pro / Imagen for consistent character references
- **Pose Library** — Generate characters in action poses with reference conditioning
- **Sprite Assembly** — Background removal, normalization, atlas packing
- **Animation Engine** — GIF/APNG assembly with frame interpolation
- **Pipeline CLI** — End-to-end automation via Typer CLI + FastAPI

## Development

```bash
npm install
npm test
```

## Automated Development

This project uses an autonomous coding pipeline:
- **Qwen3:8b** (via Aider + Ollama) writes code from Plane.so tasks
- **Sonnet** (via OpenClaw) reviews PRs hourly
- Tasks tracked in Plane.so (AI Animation project)
