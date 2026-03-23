import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ProjectConfig } from './config.js';
import { loadFrames } from '../sprite/frames.js';
import { normalizeAll } from '../sprite/normalize.js';
import { packAtlas, AtlasMetadata } from '../sprite/atlas.js';
import { createGif } from '../animation/gif.js';

/**
 * Result of a completed pipeline run.
 * @interface
 */
export interface PipelineResult {
  /** Path to the generated sprite sheet image. */
  spriteSheetPath: string;
  /** Path to the generated GIF animation, if created. */
  gifPath?: string;
  /** Atlas metadata describing the sprite sheet layout. */
  metadata: AtlasMetadata;
  /** Number of frames that were processed. */
  framesProcessed: number;
}

/**
 * Runs the full animation pipeline: load frames, normalize, pack atlas, and optionally export GIF.
 *
 * The pipeline expects frame images to already exist in `{outputDir}/frames/`.
 * It will:
 * 1. Load frames from the frames directory
 * 2. Normalize all frames to the configured sprite sheet dimensions
 * 3. Pack normalized frames into a sprite sheet atlas
 * 4. Optionally create an animated GIF from the first animation config
 *
 * @param config - Project configuration defining dimensions, format, and animation settings.
 * @returns Result containing paths to outputs and metadata.
 * @throws {Error} If the frames directory doesn't exist or contains no frames.
 */
export async function runPipeline(config: ProjectConfig): Promise<PipelineResult> {
  const framesDir = join(config.outputDir, 'frames');
  const normalizedDir = join(config.outputDir, 'normalized');
  const format = config.spriteSheet.format;

  // Ensure output directories exist
  if (!existsSync(framesDir)) {
    throw new Error(`Frames directory not found: ${framesDir}`);
  }
  mkdirSync(normalizedDir, { recursive: true });

  // Step 1: Load frames
  const frames = loadFrames(framesDir);
  if (frames.length === 0) {
    throw new Error(`No frames found in ${framesDir}`);
  }

  // Step 2: Normalize frames
  const normalizedPaths = await normalizeAll(framesDir, normalizedDir, {
    targetWidth: config.spriteSheet.frameWidth,
    targetHeight: config.spriteSheet.frameHeight,
  });

  // Step 3: Pack atlas
  const spriteSheetPath = join(config.outputDir, `spritesheet.${format}`);
  const metadata = await packAtlas(normalizedPaths, spriteSheetPath, {
    padding: config.spriteSheet.padding,
    format,
  });

  // Step 4: Export GIF (if animations are configured)
  let gifPath: string | undefined;
  if (config.animations.length > 0) {
    const anim = config.animations[0];
    gifPath = join(config.outputDir, `${anim.name.toLowerCase()}.gif`);
    await createGif(normalizedPaths, gifPath, {
      fps: anim.fps,
    });
  }

  return {
    spriteSheetPath,
    gifPath,
    metadata,
    framesProcessed: frames.length,
  };
}
