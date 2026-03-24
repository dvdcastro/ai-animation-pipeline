import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    expect(result.gifPaths).toHaveLength(1);
    expect(existsSync(result.gifPaths[0])).toBe(true);
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

    expect(result.gifPaths).toHaveLength(1);
    expect(result.gifPaths[0]).toBe(join(tempDir, 'walk.gif'));
    const buffer = readFileSync(result.gifPaths[0]);
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

    expect(result.gifPaths).toHaveLength(0);
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

  it('should export one GIF per animation when multiple animations are configured', async () => {
    await createFrames(4);
    const config = makeConfig({
      animations: [
        { name: 'Walk', frames: 4, fps: 12, poses: ['a', 'b', 'c', 'd'] },
        { name: 'Run', frames: 4, fps: 16, poses: ['e', 'f', 'g', 'h'] },
        { name: 'Jump', frames: 2, fps: 8, poses: ['i', 'j'] },
      ],
    });

    const result = await runPipeline(config);

    expect(result.gifPaths).toHaveLength(3);
    expect(result.gifPaths[0]).toBe(join(tempDir, 'walk.gif'));
    expect(result.gifPaths[1]).toBe(join(tempDir, 'run.gif'));
    expect(result.gifPaths[2]).toBe(join(tempDir, 'jump.gif'));
    for (const p of result.gifPaths) {
      expect(existsSync(p)).toBe(true);
    }
  });

  it('should normalize animation names with spaces to use hyphens in filenames', async () => {
    await createFrames(2);
    const config = makeConfig({
      animations: [
        { name: 'Walk Cycle', frames: 2, fps: 12, poses: ['a', 'b'] },
      ],
    });

    const result = await runPipeline(config);

    expect(result.gifPaths[0]).toBe(join(tempDir, 'walk-cycle.gif'));
    expect(existsSync(result.gifPaths[0])).toBe(true);
  });

  it('should append index suffix when two animations normalize to the same name', async () => {
    await createFrames(2);
    const config = makeConfig({
      animations: [
        { name: 'Walk', frames: 2, fps: 12, poses: ['a', 'b'] },
        { name: 'WALK', frames: 2, fps: 8, poses: ['c', 'd'] },
      ],
    });

    const result = await runPipeline(config);

    expect(result.gifPaths).toHaveLength(2);
    expect(result.gifPaths[0]).toBe(join(tempDir, 'walk.gif'));
    expect(result.gifPaths[1]).toBe(join(tempDir, 'walk-1.gif'));
  });

  it('should not crash when frame count is less than animation.frames config', async () => {
    await createFrames(2);
    const config = makeConfig({
      animations: [
        { name: 'Walk', frames: 10, fps: 12, poses: [] },
      ],
    });

    const result = await runPipeline(config);

    expect(result.gifPaths).toHaveLength(1);
    expect(existsSync(result.gifPaths[0])).toBe(true);
  });

  describe('per-animation framesDir', () => {
    it('should use per-animation framesDir instead of shared frames when specified', async () => {
      // Create shared frames dir (required for the pipeline shared pool)
      await createFrames(2);
      // Create per-animation subdirs
      const walkDir = join(tempDir, 'frames', 'walk');
      const runDir = join(tempDir, 'frames', 'run');
      mkdirSync(walkDir, { recursive: true });
      mkdirSync(runDir, { recursive: true });
      // Add 3 walk frames and 4 run frames
      for (let i = 0; i < 3; i++) {
        await sharp({
          create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
        }).png().toFile(join(walkDir, `frame_${String(i + 1).padStart(3, '0')}.png`));
      }
      for (let i = 0; i < 4; i++) {
        await sharp({
          create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
        }).png().toFile(join(runDir, `frame_${String(i + 1).padStart(3, '0')}.png`));
      }

      const config = makeConfig({
        animations: [
          { name: 'Walk', frames: 3, fps: 12, poses: ['a'], framesDir: 'frames/walk' },
          { name: 'Run', frames: 4, fps: 18, poses: ['b'], framesDir: 'frames/run' },
        ],
      });

      const result = await runPipeline(config);

      expect(result.gifPaths).toHaveLength(2);
      expect(existsSync(result.gifPaths[0])).toBe(true);
      expect(existsSync(result.gifPaths[1])).toBe(true);
    });

    it('should throw a descriptive error when framesDir does not exist', async () => {
      await createFrames(2);
      const config = makeConfig({
        animations: [
          { name: 'Ghost', frames: 2, fps: 8, poses: [], framesDir: 'frames/nonexistent' },
        ],
      });

      await expect(runPipeline(config)).rejects.toThrow('framesDir for animation "Ghost" not found');
    });

    it('should skip animation (not throw) when framesDir exists but is empty', async () => {
      await createFrames(2);
      const emptyDir = join(tempDir, 'frames', 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const config = makeConfig({
        animations: [
          { name: 'Empty', frames: 2, fps: 8, poses: [], framesDir: 'frames/empty' },
          { name: 'Walk', frames: 2, fps: 12, poses: [] }, // no framesDir, uses shared pool
        ],
      });

      const result = await runPipeline(config);

      // Empty animation skipped, only Walk GIF produced
      expect(result.gifPaths).toHaveLength(1);
      expect(result.gifPaths[0]).toBe(join(tempDir, 'walk.gif'));
    });

    it('should normalize per-animation frames to spriteSheet dimensions', async () => {
      await createFrames(1);
      const customDir = join(tempDir, 'frames', 'custom');
      mkdirSync(customDir, { recursive: true });
      // Create a non-32x32 frame
      await sharp({
        create: { width: 100, height: 80, channels: 4, background: { r: 100, g: 100, b: 100, alpha: 1 } },
      }).png().toFile(join(customDir, 'frame_001.png'));

      const config = makeConfig({
        spriteSheet: { frameWidth: 32, frameHeight: 32, format: 'png' },
        animations: [
          { name: 'Custom', frames: 1, fps: 8, poses: [], framesDir: 'frames/custom' },
        ],
      });

      const result = await runPipeline(config);

      expect(result.gifPaths).toHaveLength(1);
      // Confirm normalized dir was created with correct dimensions
      const normalizedDir = join(tempDir, 'normalized-custom');
      expect(existsSync(normalizedDir)).toBe(true);
      const meta = await sharp(join(normalizedDir, 'frame_001.png')).metadata();
      expect(meta.width).toBe(32);
      expect(meta.height).toBe(32);
    });

    it('should fall back to shared pool when framesDir is not set', async () => {
      await createFrames(3);
      const config = makeConfig({
        animations: [
          { name: 'Walk', frames: 3, fps: 12, poses: [] }, // no framesDir
        ],
      });

      const result = await runPipeline(config);

      expect(result.gifPaths).toHaveLength(1);
      expect(result.framesProcessed).toBe(3);
    });
  });

  describe('verbose logging', () => {
    it('should not write to stdout when verbose is false (default)', async () => {
      await createFrames(2);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        await runPipeline(makeConfig());
        expect(writeSpy).not.toHaveBeenCalled();
      } finally {
        writeSpy.mockRestore();
      }
    });

    it('should write progress logs to stdout when verbose is true', async () => {
      await createFrames(3);
      const output: string[] = [];
      const writeSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk) => { output.push(String(chunk)); return true; });

      try {
        await runPipeline(makeConfig({ verbose: true }));
        const combined = output.join('');
        expect(combined).toContain('[load]');
        expect(combined).toContain('[normalize]');
        expect(combined).toContain('[atlas]');
        expect(combined).toContain('[done]');
      } finally {
        writeSpy.mockRestore();
      }
    });

    it('should log GIF step when animations are configured and verbose is true', async () => {
      await createFrames(2);
      const output: string[] = [];
      const writeSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk) => { output.push(String(chunk)); return true; });

      try {
        await runPipeline(makeConfig({ verbose: true }));
        const combined = output.join('');
        expect(combined).toContain('[gif]');
      } finally {
        writeSpy.mockRestore();
      }
    });

    it('should not log GIF step when no animations and verbose is true', async () => {
      await createFrames(2);
      const output: string[] = [];
      const writeSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk) => { output.push(String(chunk)); return true; });

      try {
        await runPipeline(makeConfig({ verbose: true, animations: [] }));
        const combined = output.join('');
        expect(combined).not.toContain('[gif]');
        expect(combined).toContain('[done]');
      } finally {
        writeSpy.mockRestore();
      }
    });

    it('should include frame count in load log', async () => {
      await createFrames(4);
      const output: string[] = [];
      const writeSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk) => { output.push(String(chunk)); return true; });

      try {
        await runPipeline(makeConfig({ verbose: true }));
        const combined = output.join('');
        expect(combined).toContain('Loaded 4 frames');
      } finally {
        writeSpy.mockRestore();
      }
    });

    it('should not write to stdout when verbose is explicitly false', async () => {
      await createFrames(2);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        await runPipeline(makeConfig({ verbose: false }));
        expect(writeSpy).not.toHaveBeenCalled();
      } finally {
        writeSpy.mockRestore();
      }
    });
  });
});
