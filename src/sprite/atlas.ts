import sharp from 'sharp';
import { basename, extname } from 'node:path';

/**
 * Options for atlas packing.
 * @interface
 */
export interface AtlasOptions {
  /** Number of columns in the sprite sheet grid. Defaults to auto-calculated square layout. */
  columns?: number;
  /** Padding in pixels between frames. Defaults to 0. */
  padding?: number;
  /** Output image format. Defaults to 'png'. */
  format?: 'png' | 'webp';
}

/**
 * Metadata describing the packed atlas layout.
 * @interface
 */
export interface AtlasMetadata {
  /** Total width of the atlas in pixels. */
  width: number;
  /** Total height of the atlas in pixels. */
  height: number;
  /** Array of frame position and size data. */
  frames: Array<{
    /** Frame filename (without extension). */
    name: string;
    /** X offset of this frame in the atlas. */
    x: number;
    /** Y offset of this frame in the atlas. */
    y: number;
    /** Width of this frame. */
    width: number;
    /** Height of this frame. */
    height: number;
  }>;
  /** Output format of the atlas image. */
  format: string;
}

/**
 * Packs an array of frame images into a single sprite sheet atlas.
 * Frames are laid out in a grid with the specified number of columns.
 * @param frames - Array of file paths to frame images.
 * @param outputPath - Path where the atlas image will be saved.
 * @param options - Atlas packing options.
 * @returns Metadata describing the atlas layout.
 * @throws {Error} If no frames are provided or images cannot be read.
 */
export async function packAtlas(
  frames: string[],
  outputPath: string,
  options?: AtlasOptions,
): Promise<AtlasMetadata> {
  if (frames.length === 0) {
    throw new Error('No frames provided for atlas packing');
  }

  const padding = options?.padding ?? 0;
  const format = options?.format ?? 'png';

  // Read metadata for all frames
  const frameMetas = await Promise.all(
    frames.map(async (framePath) => {
      const meta = await sharp(framePath).metadata();
      return {
        path: framePath,
        name: basename(framePath, extname(framePath)),
        width: meta.width!,
        height: meta.height!,
      };
    }),
  );

  // Calculate grid layout
  const columns = options?.columns ?? Math.ceil(Math.sqrt(frameMetas.length));
  const rows = Math.ceil(frameMetas.length / columns);

  const frameWidth = Math.max(...frameMetas.map((f) => f.width));
  const frameHeight = Math.max(...frameMetas.map((f) => f.height));

  const atlasWidth = columns * frameWidth + (columns - 1) * padding;
  const atlasHeight = rows * frameHeight + (rows - 1) * padding;

  // Build composite operations
  const composites: sharp.OverlayOptions[] = [];
  const metadataFrames: AtlasMetadata['frames'] = [];

  for (let i = 0; i < frameMetas.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * (frameWidth + padding);
    const y = row * (frameHeight + padding);

    composites.push({
      input: frameMetas[i].path,
      left: x,
      top: y,
    });

    metadataFrames.push({
      name: frameMetas[i].name,
      x,
      y,
      width: frameMetas[i].width,
      height: frameMetas[i].height,
    });
  }

  // Create the atlas
  let pipeline = sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites);

  if (format === 'webp') {
    pipeline = pipeline.webp();
  } else {
    pipeline = pipeline.png();
  }

  await pipeline.toFile(outputPath);

  return {
    width: atlasWidth,
    height: atlasHeight,
    frames: metadataFrames,
    format,
  };
}
