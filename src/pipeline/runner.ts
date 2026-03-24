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
  /** Paths to generated GIF animations, one per animation in config. */
  gifPaths: string[];
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

  // Step 4: Export one GIF per animation
  const gifPaths: string[] = [];
  if (config.animations.length > 0) {
    const usedNames = new Map<string, number>();

    for (const anim of config.animations) {
      // Normalize animation name to a safe filename
      let baseName = anim.name.replace(/\s+/g, '-').toLowerCase();

      // Handle duplicate normalized names by appending an index suffix
      const count = usedNames.get(baseName) ?? 0;
      usedNames.set(baseName, count + 1);
      const fileName = count === 0 ? `${baseName}.gif` : `${baseName}-${count}.gif`;

      const gifPath = join(config.outputDir, fileName);

      // Resolve the frame pool for this animation
      let animNormalizedPaths: string[];
      if (anim.framesDir) {
        const animFramesDir = join(config.outputDir, anim.framesDir);
        if (!existsSync(animFramesDir)) {
          throw new Error(
            `framesDir for animation "${anim.name}" not found: ${animFramesDir}`,
          );
        }
        const animFrames = loadFrames(animFramesDir);
        if (animFrames.length === 0) {
          if (verbose) {
            log('gif', `Warning: animation "${anim.name}" framesDir is empty — skipping`);
          }
          continue;
        }
        // Normalize per-animation frames into a dedicated subdirectory
        const animNormalizedDir = join(config.outputDir, `normalized-${baseName}`);
        mkdirSync(animNormalizedDir, { recursive: true });
        animNormalizedPaths = await normalizeAll(animFramesDir, animNormalizedDir, {
          targetWidth: config.spriteSheet.frameWidth,
          targetHeight: config.spriteSheet.frameHeight,
        });
      } else {
        animNormalizedPaths = normalizedPaths;
      }

      if (verbose) log('gif', `Exporting ${fileName} at ${anim.fps}fps...`);
      const gifStart = now();

      // Warn if frame count is less than requested; use available frames
      if (animNormalizedPaths.length < anim.frames) {
        if (verbose) {
          log(
            'gif',
            `Warning: animation "${anim.name}" requests ${anim.frames} frames but only ${animNormalizedPaths.length} available — using all`,
          );
        }
      }

      await createGif(animNormalizedPaths, gifPath, {
        fps: anim.fps,
      });

      if (verbose) log('gif', `${fileName} saved (${elapsed(gifStart)}s)`);
      gifPaths.push(gifPath);
    }
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
    gifPaths,
    metadataPath,
    metadata,
    framesProcessed: frames.length,
  };
}
