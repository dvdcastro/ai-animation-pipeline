import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/**
 * Represents a single sprite frame with its metadata.
 * @interface
 */
export interface SpriteFrame {
  /** Unique identifier for the frame. */
  id: string;
  /** Absolute or relative path to the image file. */
  imagePath: string;
  /** Width of the frame in pixels. */
  width: number;
  /** Height of the frame in pixels. */
  height: number;
  /** Zero-based index of the frame in the animation sequence. */
  index: number;
}

/** Supported image file extensions. */
const SUPPORTED_EXTENSIONS = new Set(['.png', '.webp']);

/**
 * Loads sprite frames from a directory, reading all PNG and WebP files.
 * Files are sorted alphabetically by filename and assigned sequential indices.
 * @param directory - Path to the directory containing frame images.
 * @returns Array of SpriteFrame objects sorted by filename.
 * @throws {Error} If the directory does not exist or cannot be read.
 */
export function loadFrames(directory: string): SpriteFrame[] {
  const entries = readdirSync(directory);

  const imageFiles = entries
    .filter((file) => SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase()))
    .sort();

  return imageFiles.map((file, index) => {
    const imagePath = join(directory, file);
    const stat = statSync(imagePath);

    if (!stat.isFile()) {
      return null;
    }

    return {
      id: basename(file, extname(file)),
      imagePath,
      width: 0,
      height: 0,
      index,
    };
  }).filter((frame): frame is SpriteFrame => frame !== null);
}

/**
 * Validates that a SpriteFrame has all required fields with valid values.
 * @param frame - The SpriteFrame to validate.
 * @returns true if the frame is valid, false otherwise.
 */
export function validateFrame(frame: SpriteFrame): boolean {
  if (!frame) return false;
  if (typeof frame.id !== 'string' || frame.id.length === 0) return false;
  if (typeof frame.imagePath !== 'string' || frame.imagePath.length === 0) return false;
  if (typeof frame.width !== 'number' || frame.width <= 0) return false;
  if (typeof frame.height !== 'number' || frame.height <= 0) return false;
  if (typeof frame.index !== 'number' || frame.index < 0) return false;
  return true;
}
