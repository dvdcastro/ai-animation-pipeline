import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { createGif } from '../../src/animation/gif';

describe('GIF Export', () => {
  let tempDir: string;
  let framesDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gif-test-'));
    framesDir = join(tempDir, 'frames');
    mkdirSync(framesDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function createFrame(
    name: string,
    color: { r: number; g: number; b: number } = { r: 255, g: 0, b: 0 },
    width = 32,
    height = 32,
  ): Promise<string> {
    const path = join(framesDir, name);
    await sharp({
      create: { width, height, channels: 4, background: { ...color, alpha: 1 } },
    }).png().toFile(path);
    return path;
  }

  it('should create a GIF file from frames', async () => {
    const frames = [
      await createFrame('f1.png', { r: 255, g: 0, b: 0 }),
      await createFrame('f2.png', { r: 0, g: 255, b: 0 }),
      await createFrame('f3.png', { r: 0, g: 0, b: 255 }),
    ];
    const outputPath = join(tempDir, 'output.gif');

    await createGif(frames, outputPath);

    expect(existsSync(outputPath)).toBe(true);
    const stat = statSync(outputPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('should create a GIF with custom fps', async () => {
    const frames = [
      await createFrame('f1.png'),
      await createFrame('f2.png'),
    ];
    const outputPath = join(tempDir, 'output.gif');

    await createGif(frames, outputPath, { fps: 24 });

    expect(existsSync(outputPath)).toBe(true);
  });

  it('should create a GIF with custom quality', async () => {
    const frames = [
      await createFrame('f1.png'),
      await createFrame('f2.png'),
    ];
    const outputPath = join(tempDir, 'output.gif');

    await createGif(frames, outputPath, { quality: 1 });

    expect(existsSync(outputPath)).toBe(true);
  });

  it('should create a GIF with loop option', async () => {
    const frames = [
      await createFrame('f1.png'),
      await createFrame('f2.png'),
    ];
    const outputPath = join(tempDir, 'output.gif');

    await createGif(frames, outputPath, { loop: 3 });

    expect(existsSync(outputPath)).toBe(true);
  });

  it('should handle a single frame', async () => {
    const frames = [await createFrame('solo.png')];
    const outputPath = join(tempDir, 'output.gif');

    await createGif(frames, outputPath);

    expect(existsSync(outputPath)).toBe(true);
    const stat = statSync(outputPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('should throw for empty frames array', async () => {
    const outputPath = join(tempDir, 'output.gif');
    await expect(createGif([], outputPath)).rejects.toThrow('No frames provided');
  });

  it('should produce a valid GIF header', async () => {
    const frames = [
      await createFrame('f1.png'),
      await createFrame('f2.png'),
    ];
    const outputPath = join(tempDir, 'output.gif');

    await createGif(frames, outputPath);

    // Read the first 6 bytes to check GIF magic number
    const { readFileSync } = await import('node:fs');
    const buffer = readFileSync(outputPath);
    const header = buffer.subarray(0, 6).toString('ascii');
    expect(header).toMatch(/^GIF8[79]a$/);
  });
});
