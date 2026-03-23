import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { packAtlas } from '../../src/sprite/atlas';

describe('Sprite Sheet Atlas Packing', () => {
  let tempDir: string;
  let framesDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'atlas-test-'));
    framesDir = join(tempDir, 'frames');
    mkdirSync(framesDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function createFrame(name: string, width = 32, height = 32, color = { r: 255, g: 0, b: 0 }): Promise<string> {
    const path = join(framesDir, name);
    await sharp({
      create: { width, height, channels: 4, background: { ...color, alpha: 1 } },
    }).png().toFile(path);
    return path;
  }

  describe('packAtlas', () => {
    it('should pack frames into a single atlas image', async () => {
      const frames = [
        await createFrame('frame_01.png'),
        await createFrame('frame_02.png'),
        await createFrame('frame_03.png'),
        await createFrame('frame_04.png'),
      ];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath);

      expect(existsSync(outputPath)).toBe(true);
      expect(metadata.frames).toHaveLength(4);
      expect(metadata.format).toBe('png');

      const atlasMeta = await sharp(outputPath).metadata();
      expect(atlasMeta.width).toBe(metadata.width);
      expect(atlasMeta.height).toBe(metadata.height);
    });

    it('should use a 2x2 grid for 4 frames by default', async () => {
      const frames = [
        await createFrame('a.png'),
        await createFrame('b.png'),
        await createFrame('c.png'),
        await createFrame('d.png'),
      ];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath);

      // sqrt(4) = 2 columns, 2 rows
      expect(metadata.width).toBe(64);  // 2 * 32
      expect(metadata.height).toBe(64); // 2 * 32
    });

    it('should respect custom column count', async () => {
      const frames = [
        await createFrame('a.png'),
        await createFrame('b.png'),
        await createFrame('c.png'),
        await createFrame('d.png'),
      ];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath, { columns: 4 });

      // 4 columns, 1 row
      expect(metadata.width).toBe(128); // 4 * 32
      expect(metadata.height).toBe(32); // 1 * 32
    });

    it('should add padding between frames', async () => {
      const frames = [
        await createFrame('a.png'),
        await createFrame('b.png'),
        await createFrame('c.png'),
        await createFrame('d.png'),
      ];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath, { padding: 4 });

      // 2 columns with 4px padding: 32 + 4 + 32 = 68
      expect(metadata.width).toBe(68);
      expect(metadata.height).toBe(68);
    });

    it('should output correct frame positions', async () => {
      const frames = [
        await createFrame('a.png'),
        await createFrame('b.png'),
        await createFrame('c.png'),
        await createFrame('d.png'),
      ];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath, { columns: 2, padding: 2 });

      expect(metadata.frames[0]).toEqual({ name: 'a', x: 0, y: 0, width: 32, height: 32 });
      expect(metadata.frames[1]).toEqual({ name: 'b', x: 34, y: 0, width: 32, height: 32 });
      expect(metadata.frames[2]).toEqual({ name: 'c', x: 0, y: 34, width: 32, height: 32 });
      expect(metadata.frames[3]).toEqual({ name: 'd', x: 34, y: 34, width: 32, height: 32 });
    });

    it('should output webp format when specified', async () => {
      const frames = [
        await createFrame('a.png'),
        await createFrame('b.png'),
      ];
      const outputPath = join(tempDir, 'atlas.webp');

      const metadata = await packAtlas(frames, outputPath, { format: 'webp' });

      expect(metadata.format).toBe('webp');
      const atlasMeta = await sharp(outputPath).metadata();
      expect(atlasMeta.format).toBe('webp');
    });

    it('should handle a single frame', async () => {
      const frames = [await createFrame('single.png')];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath);

      expect(metadata.frames).toHaveLength(1);
      expect(metadata.width).toBe(32);
      expect(metadata.height).toBe(32);
      expect(metadata.frames[0]).toEqual({ name: 'single', x: 0, y: 0, width: 32, height: 32 });
    });

    it('should throw for empty frames array', async () => {
      const outputPath = join(tempDir, 'atlas.png');
      await expect(packAtlas([], outputPath)).rejects.toThrow('No frames provided');
    });

    it('should handle non-square frame counts', async () => {
      const frames = [
        await createFrame('a.png'),
        await createFrame('b.png'),
        await createFrame('c.png'),
      ];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath);

      // sqrt(3) ≈ 1.73, ceil = 2 columns, ceil(3/2) = 2 rows
      expect(metadata.width).toBe(64);
      expect(metadata.height).toBe(64);
      expect(metadata.frames).toHaveLength(3);
    });

    it('should preserve frame names from filenames', async () => {
      const frames = [
        await createFrame('walk_001.png'),
        await createFrame('walk_002.png'),
        await createFrame('walk_003.png'),
      ];
      const outputPath = join(tempDir, 'atlas.png');

      const metadata = await packAtlas(frames, outputPath);

      expect(metadata.frames.map((f) => f.name)).toEqual([
        'walk_001', 'walk_002', 'walk_003',
      ]);
    });
  });
});
