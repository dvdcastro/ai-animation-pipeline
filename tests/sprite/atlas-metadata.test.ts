import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSpritesheetJson, saveAtlasMetadata, SpritesheetJson } from '../../src/sprite/atlas-metadata';
import { AtlasMetadata } from '../../src/sprite/atlas';
import { ProjectConfig } from '../../src/pipeline/config';

describe('atlas-metadata', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'atlas-meta-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeAtlas(frameCount: number): AtlasMetadata {
    const cols = Math.ceil(Math.sqrt(frameCount));
    return {
      width: 128 * cols,
      height: 128 * Math.ceil(frameCount / cols),
      format: 'png',
      frames: Array.from({ length: frameCount }, (_, i) => ({
        name: `frame_${String(i).padStart(3, '0')}`,
        x: (i % cols) * 128,
        y: Math.floor(i / cols) * 128,
        width: 128,
        height: 128,
      })),
    };
  }

  function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
    return {
      name: 'Test Project',
      outputDir: tempDir,
      character: { description: 'hero', style: 'pixel' },
      animations: [
        { name: 'Walk', frames: 4, fps: 12, poses: ['a', 'b', 'c', 'd'] },
        { name: 'Run', frames: 4, fps: 16, poses: ['e', 'f', 'g', 'h'] },
      ],
      spriteSheet: { frameWidth: 128, frameHeight: 128, format: 'png' },
      ...overrides,
    };
  }

  describe('buildSpritesheetJson()', () => {
    it('should build correct meta block', () => {
      const atlas = makeAtlas(4);
      const config = makeConfig({ animations: [{ name: 'Walk', frames: 4, fps: 12, poses: [] }] });
      const spritesheetPath = join(tempDir, 'spritesheet.png');

      const result = buildSpritesheetJson(atlas, config, spritesheetPath);

      expect(result.meta.project).toBe('Test Project');
      expect(result.meta.image).toBe('spritesheet.png');
      expect(result.meta.width).toBe(atlas.width);
      expect(result.meta.height).toBe(atlas.height);
      expect(result.meta.format).toBe('png');
      expect(result.meta.generated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include all frames in the frames array', () => {
      const atlas = makeAtlas(6);
      const config = makeConfig({ animations: [{ name: 'Walk', frames: 6, fps: 12, poses: [] }] });
      const result = buildSpritesheetJson(atlas, config, join(tempDir, 'spritesheet.png'));

      expect(result.frames).toHaveLength(6);
      expect(result.frames[0].name).toBe('frame_000');
      expect(result.frames[0].x).toBe(0);
      expect(result.frames[0].y).toBe(0);
    });

    it('should assign frames to animations in sequence order', () => {
      const atlas = makeAtlas(8);
      const config = makeConfig();
      const result = buildSpritesheetJson(atlas, config, join(tempDir, 'spritesheet.png'));

      expect(result.animations['walk'].frames).toHaveLength(4);
      expect(result.animations['walk'].frames[0]).toBe('frame_000');
      expect(result.animations['walk'].frames[3]).toBe('frame_003');

      expect(result.animations['run'].frames).toHaveLength(4);
      expect(result.animations['run'].frames[0]).toBe('frame_004');
      expect(result.animations['run'].frames[3]).toBe('frame_007');
    });

    it('should lowercase animation names in the output', () => {
      const atlas = makeAtlas(4);
      const config = makeConfig({
        animations: [{ name: 'RunFast', frames: 4, fps: 24, poses: [] }],
      });
      const result = buildSpritesheetJson(atlas, config, join(tempDir, 'spritesheet.png'));

      expect(result.animations['runfast']).toBeDefined();
      expect(result.animations['RunFast']).toBeUndefined();
    });

    it('should set correct fps per animation', () => {
      const atlas = makeAtlas(8);
      const config = makeConfig();
      const result = buildSpritesheetJson(atlas, config, join(tempDir, 'spritesheet.png'));

      expect(result.animations['walk'].fps).toBe(12);
      expect(result.animations['run'].fps).toBe(16);
    });

    it('should distribute frames proportionally when fewer frames than requested', () => {
      const atlas = makeAtlas(4); // only 4 frames
      const config = makeConfig(); // requests 4 walk + 4 run = 8 total
      const warnings: string[] = [];

      const result = buildSpritesheetJson(atlas, config, join(tempDir, 'spritesheet.png'), {
        warn: (msg) => warnings.push(msg),
      });

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('Warning');
      // All 4 frames should be distributed between the two animations (no frames left out)
      const totalAssigned = Object.values(result.animations).reduce(
        (sum, a) => sum + a.frames.length, 0
      );
      expect(totalAssigned).toBe(4);
    });

    it('should handle a single animation correctly', () => {
      const atlas = makeAtlas(3);
      const config = makeConfig({
        animations: [{ name: 'Idle', frames: 3, fps: 8, poses: [] }],
      });
      const result = buildSpritesheetJson(atlas, config, join(tempDir, 'spritesheet.png'));

      expect(result.animations['idle'].frames).toHaveLength(3);
    });

    it('should produce empty animations block when no animations configured', () => {
      const atlas = makeAtlas(4);
      const config = makeConfig({ animations: [] });
      const result = buildSpritesheetJson(atlas, config, join(tempDir, 'spritesheet.png'));

      expect(result.animations).toEqual({});
    });
  });

  describe('saveAtlasMetadata()', () => {
    it('should write valid JSON to the output path', () => {
      const atlas = makeAtlas(4);
      const config = makeConfig({ animations: [{ name: 'Walk', frames: 4, fps: 12, poses: [] }] });
      const outputPath = join(tempDir, 'spritesheet.json');

      saveAtlasMetadata(outputPath, atlas, config, join(tempDir, 'spritesheet.png'));

      expect(existsSync(outputPath)).toBe(true);
      const raw = readFileSync(outputPath, 'utf-8');
      const parsed: SpritesheetJson = JSON.parse(raw);
      expect(parsed.meta.project).toBe('Test Project');
      expect(parsed.frames).toHaveLength(4);
    });

    it('should overwrite an existing file by default', () => {
      const outputPath = join(tempDir, 'spritesheet.json');
      writeFileSync(outputPath, JSON.stringify({ old: true }), 'utf-8');

      const atlas = makeAtlas(2);
      const config = makeConfig({ animations: [{ name: 'Walk', frames: 2, fps: 12, poses: [] }] });
      saveAtlasMetadata(outputPath, atlas, config, join(tempDir, 'spritesheet.png'));

      const parsed = JSON.parse(readFileSync(outputPath, 'utf-8'));
      expect(parsed.old).toBeUndefined();
      expect(parsed.meta).toBeDefined();
    });

    it('should skip writing when noOverwrite is true and file exists', () => {
      const outputPath = join(tempDir, 'spritesheet.json');
      writeFileSync(outputPath, JSON.stringify({ old: true }), 'utf-8');

      const atlas = makeAtlas(2);
      const config = makeConfig({ animations: [] });
      saveAtlasMetadata(outputPath, atlas, config, join(tempDir, 'spritesheet.png'), {
        noOverwrite: true,
      });

      const parsed = JSON.parse(readFileSync(outputPath, 'utf-8'));
      expect(parsed.old).toBe(true);
    });

    it('should write when noOverwrite is true but file does not exist', () => {
      const outputPath = join(tempDir, 'spritesheet.json');
      const atlas = makeAtlas(2);
      const config = makeConfig({ animations: [{ name: 'Walk', frames: 2, fps: 12, poses: [] }] });

      saveAtlasMetadata(outputPath, atlas, config, join(tempDir, 'spritesheet.png'), {
        noOverwrite: true,
      });

      expect(existsSync(outputPath)).toBe(true);
    });

    it('should produce pretty-printed JSON', () => {
      const outputPath = join(tempDir, 'spritesheet.json');
      const atlas = makeAtlas(2);
      const config = makeConfig({ animations: [] });

      saveAtlasMetadata(outputPath, atlas, config, join(tempDir, 'spritesheet.png'));

      const raw = readFileSync(outputPath, 'utf-8');
      expect(raw).toContain('\n');
      expect(raw).toContain('  ');
    });
  });
});
