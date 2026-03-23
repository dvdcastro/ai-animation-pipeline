import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import sharp from 'sharp';

/**
 * Options for normalizing sprite frames.
 * @interface
 */
export interface NormalizeOptions {
  /** Target width in pixels. */
  targetWidth: number;
  /** Target height in pixels. */
  targetHeight: number;
  /** Background color for padding (CSS color string, default: transparent). */
  background?: string;
  /** Resize fit mode (default: 'contain'). */
  fit?: 'contain' | 'cover' | 'fill';
}

/**
 * Parses a CSS color string into an RGBA object for sharp.
 * Supports hex (#rrggbb, #rrggbbaa) and the keyword 'transparent'.
 */
function parseBackground(color?: string): { r: number; g: number; b: number; alpha: number } {
  if (!color || color === 'transparent') {
    return { r: 0, g: 0, b: 0, alpha: 0 };
  }
  if (color.startsWith('#') && (color.length === 7 || color.length === 9)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const alpha = color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
    return { r, g, b, alpha };
  }
  return { r: 0, g: 0, b: 0, alpha: 0 };
}

/**
 * Normalizes a single frame image to the specified dimensions.
 * @param inputPath - Path to the source image file.
 * @param outputPath - Path where the normalized image will be saved.
 * @param options - Normalization options (dimensions, background, fit mode).
 * @throws {Error} If the input file cannot be read or processed.
 */
export async function normalizeFrame(
  inputPath: string,
  outputPath: string,
  options: NormalizeOptions,
): Promise<void> {
  const bg = parseBackground(options.background);
  const fit = options.fit ?? 'contain';

  let pipeline = sharp(inputPath).resize(options.targetWidth, options.targetHeight, {
    fit,
    background: bg,
  });

  if (fit === 'contain') {
    pipeline = pipeline.flatten({ background: bg }).extend({
      background: bg,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  }

  await pipeline.png().toFile(outputPath);
}

/**
 * Normalizes all image files in a directory to the specified dimensions.
 * @param inputDir - Directory containing source images (PNG/WebP).
 * @param outputDir - Directory where normalized images will be saved. Created if it doesn't exist.
 * @param options - Normalization options.
 * @returns Array of output file paths for the normalized images.
 * @throws {Error} If the input directory cannot be read.
 */
export async function normalizeAll(
  inputDir: string,
  outputDir: string,
  options: NormalizeOptions,
): Promise<string[]> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const supportedExts = new Set(['.png', '.webp']);
  const files = readdirSync(inputDir)
    .filter((f) => supportedExts.has(extname(f).toLowerCase()))
    .sort();

  const outputPaths: string[] = [];

  for (const file of files) {
    const inputPath = join(inputDir, file);
    const outputPath = join(outputDir, file);
    await normalizeFrame(inputPath, outputPath, options);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}
