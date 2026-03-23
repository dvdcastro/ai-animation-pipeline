# AI Animation Pipeline

Generate game-ready sprite sheets using AI image generation.

## Architecture

- **Character Generation** — Nano Banana Pro / Imagen for consistent character references
- **Pose Library** — Generate characters in action poses with reference conditioning
- **Sprite Assembly** — Background removal, normalization, atlas packing
- **Animation Engine** — GIF/APNG assembly with frame interpolation
- **Pipeline CLI** — End-to-end automation via Typer CLI + FastAPI

## CLI Usage

### Quickstart

```bash
npm install
npm run build
```

#### Initialize a new config

```bash
npx . init
# → Creates ./animation.yaml with sensible defaults
```

#### Run the pipeline

```bash
npx . generate --config animation.yaml
# → Runs pipeline, prints frame count + output paths
```

#### Subcommands

| Command | Description |
|---|---|
| `animate init` | Write a starter `animation.yaml` to the current directory |
| `animate generate --config <path>` | Run the full pipeline from a YAML config |

### Install globally

```bash
npm install -g .
animate generate --config animation.yaml
```

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
