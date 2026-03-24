import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ProjectConfig } from './config.js';
import { loadFrames } from '../sprite/frames.js';
import { normalizeAll } from '../sprite/normalize.js';
import { packAtlas, AtlasMetadata } from '../sprite/atlas.js';
import { saveAtlasMetadata } from '../sprite/atlas-metadata.js';
import { createGif } from '../animation/gif.js';
import { log, now, elapsed } from '../utils/logger.js';

/**
 * Result of a completed pipeline run.
 * @interface
 */
export interface PipelineResult {
  /** Path to the generated sprite sheet image. */
  spriteSheetPath: string;
  /** Path to the generated GIF animation, if created. */
  gifPath?: string;
  /** Path to the saved atlas metadata JSON file. */
  metadataPath: string;
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
 * When `config.verbose` is true, timestamped progress logs are printed to stdout.
 *
 * @param config - Project configuration defining dimensions, format, and animation settings.
 * @returns Result containing paths to outputs and metadata.
 * @throws {Error} If the frames directory doesn't exist or contains no frames.
 */
export async function runPipeline(config: ProjectConfig): Promise<PipelineResult> {
  const verbose = config.verbose ?? false;
  const framesDir = join(config.outputDir, 'frames');
  const normalizedDir = join(config.outputDir, 'normalized');
  const format = config.spriteSheet.format;

  const pipelineStart = now();

  // Ensure output directories exist
  if (!existsSync(framesDir)) {
    throw new Error(`Frames directory not found: ${framesDir}`);
  }
  mkdirSync(normalizedDir, { recursive: true });

  // Step 1: Load frames
  if (verbose) log('load', `Loading frames from ${framesDir}...`);
  const frames = loadFrames(framesDir);
  if (frames.length === 0) {
    if (verbose) log('load', `Warning: no frames found in ${framesDir}`);
    throw new Error(`No frames found in ${framesDir}`);
  }
  if (verbose) log('load', `Loaded ${frames.length} frame${frames.length === 1 ? '' : 's'}`);

  // Step 2: Normalize frames
  const normalizeStart = now();
  if (verbose) {
    log(
      'normalize',
      `Normalizing ${frames.length} frame${frames.length === 1 ? '' : 's'} to ` +
        `${config.spriteSheet.frameWidth}x${config.spriteSheet.frameHeight}...`,
    );
  }
  const normalizedPaths = await normalizeAll(framesDir, normalizedDir, {
    targetWidth: config.spriteSheet.frameWidth,
    targetHeight: config.spriteSheet.frameHeight,
  });
  if (verbose) log('normalize', `Done in ${elapsed(normalizeStart)}s`);

  // Step 3: Pack atlas
  const atlasStart = now();
  const spriteSheetPath = join(config.outputDir, `spritesheet.${format}`);
  const cols = Math.ceil(Math.sqrt(normalizedPaths.length));
  const rows = Math.ceil(normalizedPaths.length / cols);
  if (verbose) log('atlas', `Packing atlas (${cols} cols × ${rows} rows)...`);
  const metadata = await packAtlas(normalizedPaths, spriteSheetPath, {
    padding: config.spriteSheet.padding,
    format,
  });
  if (verbose) log('atlas', `Saved → ${spriteSheetPath} (${elapsed(atlasStart)}s)`);

  // Step 3b: Save atlas metadata JSON
  const metadataPath = join(config.outputDir, 'spritesheet.json');
  saveAtlasMetadata(metadataPath, metadata, config, spriteSheetPath, {
    warn: (msg) => { if (verbose) log('atlas', msg); },
  });
  if (verbose) log('atlas', `Metadata → ${metadataPath}`);

  // Step 4: Export GIF (if animations are configured)
  let gifPath: string | undefined;
  if (config.animations.length > 0) {
    const anim = config.animations[0];
    gifPath = join(config.outputDir, `${anim.name.toLowerCase()}.gif`);
    if (verbose) log('gif', `Exporting GIF at ${anim.fps}fps...`);
    const gifStart = now();
    await createGif(normalizedPaths, gifPath, {
      fps: anim.fps,
    });
    if (verbose) log('gif', `Saved → ${gifPath} (${elapsed(gifStart)}s)`);
  }

  if (verbose) {
    const totalSecs = elapsed(pipelineStart);
    const w = metadata.width;
    const h = metadata.height;
    const n = frames.length;
    log(
      'done',
      `Done in ${totalSecs}s → ${spriteSheetPath} (${n} frame${n === 1 ? '' : 's'}, ${w}×${h})`,
    );
  }

  return {
    spriteSheetPath,
    gifPath,
    metadataPath,
    metadata,
    framesProcessed: frames.length,
  };
}
