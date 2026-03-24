/**
 * Minimal type declarations for gif-encoder-2.
 * The package ships no TypeScript types; this file provides enough
 * coverage for the API surface used in src/animation/gif.ts.
 */

declare module 'gif-encoder-2' {
  import { Readable } from 'node:stream';

  class GIFEncoder {
    constructor(
      width: number,
      height: number,
      algorithm?: 'neuquant' | 'octree',
      useOptimizer?: boolean,
      totalFrames?: number,
    );

    /** Returns a Readable stream of the encoded GIF data. */
    createReadStream(): Readable;

    /** Start the encoder. Must be called before addFrame(). */
    start(): void;

    /** Set loop count. 0 = infinite. */
    setRepeat(repeat: number): void;

    /** Set frame delay in milliseconds. */
    setDelay(delay: number): void;

    /**
     * Set quantization quality.
     * @param quality - 1–30; lower is higher quality.
     */
    setQuality(quality: number): void;

    /**
     * Add a frame.
     * @param pixels - Raw RGBA pixel data buffer.
     */
    addFrame(pixels: Buffer | unknown): void;

    /** Finish encoding and flush the stream. */
    finish(): void;
  }

  export = GIFEncoder;
}
