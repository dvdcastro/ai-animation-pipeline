import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { normalizeFrame, normalizeAll } from '../../src/sprite/normalize';

describe('Frame Normalization', () => {
  let tempDir: string;
  let inputDir: string;
  let outputDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'normalize-test-'));
    inputDir = join(tempDir, 'input');
    outputDir = join(tempDir, 'output');
    require('node:fs').mkdirSync(inputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function createTestImage(dir: string, name: string, width: number, height: number): Promise<string> {
    const path = join(dir, name);
    await sharp({
      create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    }).png().toFile(path);
    return path;
  }

  describe('normalizeFrame', () => {
    it('should resize an image to the target dimensions with contain', async () => {
      const input = await createTestImage(inputDir, 'frame.png', 100, 50);
      const output = join(outputDir, 'frame.png');
      require('node:fs').mkdirSync(outputDir, { recursive: true });

      await normalizeFrame(input, output, {
        targetWidth: 64,
        targetHeight: 64,
        fit: 'contain',
      });

      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(64);
      expect(meta.height).toBe(64);
    });

    it('should resize with cover mode', async () => {
      const input = await createTestImage(inputDir, 'frame.png', 100, 50);
      const output = join(outputDir, 'frame.png');
      require('node:fs').mkdirSync(outputDir, { recursive: true });

      await normalizeFrame(input, output, {
        targetWidth: 64,
        targetHeight: 64,
        fit: 'cover',
      });

      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(64);
      expect(meta.height).toBe(64);
    });

    it('should resize with fill mode', async () => {
      const input = await createTestImage(inputDir, 'frame.png', 100, 50);
      const output = join(outputDir, 'frame.png');
      require('node:fs').mkdirSync(outputDir, { recursive: true });

      await normalizeFrame(input, output, {
        targetWidth: 32,
        targetHeight: 32,
        fit: 'fill',
      });

      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(32);
      expect(meta.height).toBe(32);
    });

    it('should use custom background color', async () => {
      const input = await createTestImage(inputDir, 'frame.png', 100, 50);
      const output = join(outputDir, 'frame.png');
      require('node:fs').mkdirSync(outputDir, { recursive: true });

      await normalizeFrame(input, output, {
        targetWidth: 64,
        targetHeight: 64,
        background: '#ff0000',
        fit: 'contain',
      });

      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(64);
      expect(meta.height).toBe(64);
    });

    it('should default to contain fit mode', async () => {
      const input = await createTestImage(inputDir, 'frame.png', 100, 50);
      const output = join(outputDir, 'frame.png');
      require('node:fs').mkdirSync(outputDir, { recursive: true });

      await normalizeFrame(input, output, {
        targetWidth: 64,
        targetHeight: 64,
      });

      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(64);
      expect(meta.height).toBe(64);
    });

    it('should upscale a small image', async () => {
      const input = await createTestImage(inputDir, 'tiny.png', 8, 8);
      const output = join(outputDir, 'tiny.png');
      require('node:fs').mkdirSync(outputDir, { recursive: true });

      await normalizeFrame(input, output, {
        targetWidth: 64,
        targetHeight: 64,
      });

      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(64);
      expect(meta.height).toBe(64);
    });
  });

  describe('normalizeAll', () => {
    it('should normalize all images in a directory', async () => {
      await createTestImage(inputDir, 'frame_01.png', 100, 50);
      await createTestImage(inputDir, 'frame_02.png', 80, 80);
      await createTestImage(inputDir, 'frame_03.png', 120, 60);

      const results = await normalizeAll(inputDir, outputDir, {
        targetWidth: 64,
        targetHeight: 64,
      });

      expect(results).toHaveLength(3);

      for (const path of results) {
        const meta = await sharp(path).metadata();
        expect(meta.width).toBe(64);
        expect(meta.height).toBe(64);
      }
    });

    it('should create the output directory if it does not exist', async () => {
      await createTestImage(inputDir, 'frame.png', 32, 32);
      const nestedOutput = join(tempDir, 'deep', 'nested', 'output');

      const results = await normalizeAll(inputDir, nestedOutput, {
        targetWidth: 64,
        targetHeight: 64,
      });

      expect(results).toHaveLength(1);
      const meta = await sharp(results[0]).metadata();
      expect(meta.width).toBe(64);
    });

    it('should return output paths sorted alphabetically', async () => {
      await createTestImage(inputDir, 'c.png', 32, 32);
      await createTestImage(inputDir, 'a.png', 32, 32);
      await createTestImage(inputDir, 'b.png', 32, 32);

      const results = await normalizeAll(inputDir, outputDir, {
        targetWidth: 64,
        targetHeight: 64,
      });

      expect(results.map((p) => p.split('/').pop())).toEqual(['a.png', 'b.png', 'c.png']);
    });

    it('should ignore non-image files', async () => {
      await createTestImage(inputDir, 'frame.png', 32, 32);
      require('node:fs').writeFileSync(join(inputDir, 'readme.txt'), 'not an image');

      const results = await normalizeAll(inputDir, outputDir, {
        targetWidth: 64,
        targetHeight: 64,
      });

      expect(results).toHaveLength(1);
    });

    it('should return empty array for empty directory', async () => {
      const results = await normalizeAll(inputDir, outputDir, {
        targetWidth: 64,
        targetHeight: 64,
      });

      expect(results).toHaveLength(0);
    });
  });
});
