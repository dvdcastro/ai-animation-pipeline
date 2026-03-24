import { writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { AtlasMetadata } from './atlas.js';
import { ProjectConfig } from '../pipeline/config.js';

/**
 * The full spritesheet JSON metadata format, compatible with game engines like Unity, Godot, and Phaser.
 * @interface
 */
export interface SpritesheetJson {
  /** Global metadata about this sprite sheet. */
  meta: {
    /** ISO 8601 timestamp when this file was generated. */
    generated: string;
    /** Project name from the pipeline config. */
    project: string;
    /** Filename of the accompanying sprite sheet image. */
    image: string;
    /** Total width of the sprite sheet in pixels. */
    width: number;
    /** Total height of the sprite sheet in pixels. */
    height: number;
    /** Image format (e.g. "png" or "webp"). */
    format: string;
  };
  /** Array of frame descriptors with position and size data. */
  frames: Array<{
    /** Frame name (basename without extension). */
    name: string;
    /** X offset of this frame within the sprite sheet, in pixels. */
    x: number;
    /** Y offset of this frame within the sprite sheet, in pixels. */
    y: number;
    /** Width of this frame in pixels. */
    width: number;
    /** Height of this frame in pixels. */
    height: number;
  }>;
  /** Animation sequences keyed by animation name (lowercased). */
  animations: Record<string, { frames: string[]; fps: number }>;
}

/**
 * Builds a SpritesheetJson object from atlas metadata and project config.
 * Assigns frames to animations in order: the first `anim.frames` frames go to the first animation,
 * the next `anim.frames` to the second, and so on.
 * If total available frames < total requested by all animations, frames are distributed
 * proportionally across animations and a warning is emitted.
 *
 * @param atlas - Atlas metadata from packAtlas().
 * @param config - Project configuration with animation definitions.
 * @param spritesheetPath - Absolute or relative path to the sprite sheet image file.
 * @param options - Optional callbacks and flags.
 * @param options.warn - Optional callback for emitting warnings (e.g. frame shortage).
 * @returns Fully populated SpritesheetJson object.
 */
export function buildSpritesheetJson(
  atlas: AtlasMetadata,
  config: ProjectConfig,
  spritesheetPath: string,
  options?: { warn?: (msg: string) => void },
): SpritesheetJson {
  const frameNames = atlas.frames.map((f) => f.name);
  const totalFrames = frameNames.length;
  const totalRequested = config.animations.reduce((sum, a) => sum + a.frames, 0);

  const animations: Record<string, { frames: string[]; fps: number }> = {};
  let frameOffset = 0;

  if (totalFrames < totalRequested && config.animations.length > 0) {
    options?.warn?.(
      `Warning: ${totalFrames} frame${totalFrames === 1 ? '' : 's'} available but animations ` +
        `request ${totalRequested} total. Distributing available frames proportionally.`,
    );
  }

  for (const anim of config.animations) {
    if (frameOffset >= totalFrames) break;

    let count: number;
    if (totalFrames < totalRequested && totalRequested > 0) {
      // Distribute proportionally, rounding to nearest int
      count = Math.max(1, Math.round((anim.frames / totalRequested) * totalFrames));
    } else {
      count = anim.frames;
    }

    // Clamp so we don't exceed the available frames
    count = Math.min(count, totalFrames - frameOffset);

    animations[anim.name.toLowerCase()] = {
      frames: frameNames.slice(frameOffset, frameOffset + count),
      fps: anim.fps,
    };

    frameOffset += count;
  }

  return {
    meta: {
      generated: new Date().toISOString(),
      project: config.name,
      image: basename(spritesheetPath),
      width: atlas.width,
      height: atlas.height,
      format: atlas.format,
    },
    frames: atlas.frames,
    animations,
  };
}

/**
 * Saves atlas metadata as a JSON file suitable for consumption by game engines.
 * The file format includes a `meta` block, a `frames` array, and an `animations` map.
 *
 * @param outputPath - Path where the JSON file will be written.
 * @param atlas - Atlas metadata returned by packAtlas().
 * @param config - Project configuration (used for project name and animation definitions).
 * @param spritesheetPath - Path to the sprite sheet image (used for the `meta.image` field).
 * @param options - Optional flags and callbacks.
 * @param options.noOverwrite - If true and the file already exists, the write is skipped.
 * @param options.warn - Optional callback for emitting warnings (e.g. frame shortage).
 */
export function saveAtlasMetadata(
  outputPath: string,
  atlas: AtlasMetadata,
  config: ProjectConfig,
  spritesheetPath: string,
  options?: { noOverwrite?: boolean; warn?: (msg: string) => void },
): void {
  if (options?.noOverwrite && existsSync(outputPath)) {
    return;
  }

  const json = buildSpritesheetJson(atlas, config, spritesheetPath, options);
  writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');
}
