import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { runPipeline } from '../../src/pipeline/runner';
import { ProjectConfig } from '../../src/pipeline/config';

describe('Pipeline Runner', () => {
  let tempDir: string;
  let framesDir: string;

  function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
    return {
      name: 'Test Project',
      outputDir: tempDir,
      character: {
        description: 'Test character',
        style: 'cartoon',
      },
      animations: [
        {
          name: 'Walk',
          frames: 4,
          fps: 12,
          poses: ['step1', 'step2', 'step3', 'step4'],
        },
      ],
      spriteSheet: {
        frameWidth: 32,
        frameHeight: 32,
        format: 'png',
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'runner-test-'));
    framesDir = join(tempDir, 'frames');
    mkdirSync(framesDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function createFrames(count: number, width = 48, height = 48): Promise<void> {
    for (let i = 0; i < count; i++) {
      const name = `frame_${String(i + 1).padStart(3, '0')}.png`;
      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: Math.floor(255 * i / count), g: 100, b: 200, alpha: 1 },
        },
      }).png().toFile(join(framesDir, name));
    }
  }

  it('should run the full pipeline and produce outputs', async () => {
    await createFrames(4);
    const config = makeConfig();

    const result = await runPipeline(config);

    expect(result.framesProcessed).toBe(4);
    expect(existsSync(result.spriteSheetPath)).toBe(true);
    expect(result.gifPath).toBeDefined();
    expect(existsSync(result.gifPath!)).toBe(true);
    expect(result.metadata.frames).toHaveLength(4);
    expect(result.metadata.format).toBe('png');
  });

  it('should create normalized frames at the configured dimensions', async () => {
    await createFrames(2, 100, 50);
    const config = makeConfig({
      spriteSheet: { frameWidth: 64, frameHeight: 64, format: 'png' },
    });

    await runPipeline(config);

    const normalizedDir = join(tempDir, 'normalized');
    expect(existsSync(normalizedDir)).toBe(true);

    const meta = await sharp(join(normalizedDir, 'frame_001.png')).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);
  });

  it('should produce a sprite sheet with correct atlas metadata', async () => {
    await createFrames(4);
    const config = makeConfig({
      spriteSheet: { frameWidth: 32, frameHeight: 32, padding: 2, format: 'png' },
    });

    const result = await runPipeline(config);

    // 4 frames, 2x2 grid, 32px + 2px padding
    expect(result.metadata.width).toBe(66); // 32 + 2 + 32
    expect(result.metadata.height).toBe(66);
    expect(result.metadata.frames[0].x).toBe(0);
    expect(result.metadata.frames[1].x).toBe(34);
  });

  it('should create a GIF named after the first animation', async () => {
    await createFrames(3);
    const config = makeConfig();

    const result = await runPipeline(config);

    expect(result.gifPath).toBe(join(tempDir, 'walk.gif'));
    const buffer = readFileSync(result.gifPath!);
    const header = buffer.subarray(0, 6).toString('ascii');
    expect(header).toMatch(/^GIF8[79]a$/);
  });

  it('should support webp format for sprite sheet', async () => {
    await createFrames(2);
    const config = makeConfig({
      spriteSheet: { frameWidth: 32, frameHeight: 32, format: 'webp' },
    });

    const result = await runPipeline(config);

    expect(result.spriteSheetPath).toContain('.webp');
    expect(result.metadata.format).toBe('webp');
    const meta = await sharp(result.spriteSheetPath).metadata();
    expect(meta.format).toBe('webp');
  });

  it('should skip GIF creation when no animations are configured', async () => {
    await createFrames(2);
    const config = makeConfig({ animations: [] });

    const result = await runPipeline(config);

    expect(result.gifPath).toBeUndefined();
    expect(existsSync(result.spriteSheetPath)).toBe(true);
  });

  it('should throw if frames directory does not exist', async () => {
    rmSync(framesDir, { recursive: true, force: true });
    const config = makeConfig();

    await expect(runPipeline(config)).rejects.toThrow('Frames directory not found');
  });

  it('should throw if frames directory is empty', async () => {
    // framesDir exists but has no images
    const config = makeConfig();

    await expect(runPipeline(config)).rejects.toThrow('No frames found');
  });

  it('should handle many frames', async () => {
    await createFrames(12);
    const config = makeConfig();

    const result = await runPipeline(config);

    expect(result.framesProcessed).toBe(12);
    expect(result.metadata.frames).toHaveLength(12);
  });
});
