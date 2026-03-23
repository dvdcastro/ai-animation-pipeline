import sharp from 'sharp';
import GIFEncoder from 'gif-encoder-2';
import { createWriteStream } from 'node:fs';

/**
 * Options for GIF creation.
 * @interface
 */
export interface GifOptions {
  /** Frames per second (default: 12). */
  fps?: number;
  /** Number of loops. 0 = infinite (default: 0). */
  loop?: number;
  /** Quality of color quantization, 1-30. Lower is better quality (default: 10). */
  quality?: number;
}

/**
 * Creates an animated GIF from an array of frame image paths.
 * @param frames - Array of file paths to frame images (PNG or WebP).
 * @param outputPath - Path where the GIF will be saved.
 * @param options - GIF encoding options.
 * @throws {Error} If no frames are provided or images cannot be read.
 */
export async function createGif(
  frames: string[],
  outputPath: string,
  options?: GifOptions,
): Promise<void> {
  if (frames.length === 0) {
    throw new Error('No frames provided for GIF creation');
  }

  const fps = options?.fps ?? 12;
  const loop = options?.loop ?? 0;
  const quality = options?.quality ?? 10;

  // Read first frame to get dimensions
  const firstMeta = await sharp(frames[0]).metadata();
  const width = firstMeta.width!;
  const height = firstMeta.height!;

  const encoder = new GIFEncoder(width, height);
  const delay = Math.round(1000 / fps);

  const writeStream = createWriteStream(outputPath);

  await new Promise<void>((resolve, reject) => {
    encoder.createReadStream().pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);

    encoder.start();
    encoder.setRepeat(loop === 0 ? 0 : loop);
    encoder.setDelay(delay);
    encoder.setQuality(quality);

    (async () => {
      try {
        for (const framePath of frames) {
          const rawPixels = await sharp(framePath)
            .resize(width, height, { fit: 'fill' })
            .ensureAlpha()
            .raw()
            .toBuffer();

          encoder.addFrame(rawPixels as unknown as CanvasRenderingContext2D);
        }
        encoder.finish();
      } catch (err) {
        reject(err);
      }
    })();
  });
}
