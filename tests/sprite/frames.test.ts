import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { loadFrames, validateFrame, SpriteFrame } from '../../src/sprite/frames';

describe('Sprite Frame Management', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'frames-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadFrames', () => {
    it('should load PNG files from a directory', async () => {
      // Create small test PNGs
      await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
        .png().toFile(join(tempDir, 'frame_001.png'));
      await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } })
        .png().toFile(join(tempDir, 'frame_002.png'));

      const frames = loadFrames(tempDir);
      expect(frames).toHaveLength(2);
      expect(frames[0].id).toBe('frame_001');
      expect(frames[0].index).toBe(0);
      expect(frames[1].id).toBe('frame_002');
      expect(frames[1].index).toBe(1);
    });

    it('should load WebP files from a directory', async () => {
      await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } })
        .webp().toFile(join(tempDir, 'sprite_01.webp'));

      const frames = loadFrames(tempDir);
      expect(frames).toHaveLength(1);
      expect(frames[0].id).toBe('sprite_01');
      expect(frames[0].imagePath).toBe(join(tempDir, 'sprite_01.webp'));
    });

    it('should ignore non-image files', async () => {
      await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
        .png().toFile(join(tempDir, 'frame.png'));
      writeFileSync(join(tempDir, 'readme.txt'), 'not an image');
      writeFileSync(join(tempDir, 'data.json'), '{}');

      const frames = loadFrames(tempDir);
      expect(frames).toHaveLength(1);
      expect(frames[0].id).toBe('frame');
    });

    it('should return frames sorted alphabetically', async () => {
      for (const name of ['c_frame.png', 'a_frame.png', 'b_frame.png']) {
        await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
          .png().toFile(join(tempDir, name));
      }

      const frames = loadFrames(tempDir);
      expect(frames.map((f) => f.id)).toEqual(['a_frame', 'b_frame', 'c_frame']);
      expect(frames.map((f) => f.index)).toEqual([0, 1, 2]);
    });

    it('should return an empty array for a directory with no images', () => {
      writeFileSync(join(tempDir, 'notes.txt'), 'hello');
      const frames = loadFrames(tempDir);
      expect(frames).toHaveLength(0);
    });

    it('should return an empty array for an empty directory', () => {
      const frames = loadFrames(tempDir);
      expect(frames).toHaveLength(0);
    });

    it('should throw for a non-existent directory', () => {
      expect(() => loadFrames('/nonexistent/path')).toThrow();
    });

    it('should handle mixed PNG and WebP files', async () => {
      await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
        .png().toFile(join(tempDir, 'a.png'));
      await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
        .webp().toFile(join(tempDir, 'b.webp'));

      const frames = loadFrames(tempDir);
      expect(frames).toHaveLength(2);
      expect(frames[0].id).toBe('a');
      expect(frames[1].id).toBe('b');
    });
  });

  describe('validateFrame', () => {
    it('should return true for a valid frame', () => {
      const frame: SpriteFrame = {
        id: 'frame_001',
        imagePath: '/path/to/frame.png',
        width: 64,
        height: 64,
        index: 0,
      };
      expect(validateFrame(frame)).toBe(true);
    });

    it('should return false for zero width', () => {
      const frame: SpriteFrame = {
        id: 'frame_001',
        imagePath: '/path/to/frame.png',
        width: 0,
        height: 64,
        index: 0,
      };
      expect(validateFrame(frame)).toBe(false);
    });

    it('should return false for negative height', () => {
      const frame: SpriteFrame = {
        id: 'frame_001',
        imagePath: '/path/to/frame.png',
        width: 64,
        height: -10,
        index: 0,
      };
      expect(validateFrame(frame)).toBe(false);
    });

    it('should return false for empty id', () => {
      const frame: SpriteFrame = {
        id: '',
        imagePath: '/path/to/frame.png',
        width: 64,
        height: 64,
        index: 0,
      };
      expect(validateFrame(frame)).toBe(false);
    });

    it('should return false for empty imagePath', () => {
      const frame: SpriteFrame = {
        id: 'frame_001',
        imagePath: '',
        width: 64,
        height: 64,
        index: 0,
      };
      expect(validateFrame(frame)).toBe(false);
    });

    it('should return false for negative index', () => {
      const frame: SpriteFrame = {
        id: 'frame_001',
        imagePath: '/path/to/frame.png',
        width: 64,
        height: 64,
        index: -1,
      };
      expect(validateFrame(frame)).toBe(false);
    });

    it('should return false for null frame', () => {
      expect(validateFrame(null as unknown as SpriteFrame)).toBe(false);
    });
  });
});
