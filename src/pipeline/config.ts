import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';

/**
 * Interface defining the structure of a project configuration for the AI Animation Pipeline.
 * @interface
 */
export interface ProjectConfig {
  /** Name of the project. */
  name: string;

  /** Directory where output files will be saved. */
  outputDir: string;

  /** Character configuration. */
  character: {
    /** Description of the character. */
    description: string;
    /** Art style of the character (e.g., 'cartoon', 'realistic'). */
    style: string;
    /** Optional array of reference images for the character. */
    referenceImages?: string[];
  };

  /** Array of animation definitions. */
  animations: Array<{
    /** Name of the animation. */
    name: string;
    /** Number of frames in the animation. */
    frames: number;
    /** Frames per second for the animation. */
    fps: number;
    /** Array of pose names for the animation. */
    poses: string[];
  }>;

  /**
   * When true, the pipeline runner will print timestamped progress logs to stdout.
   * Defaults to false.
   */
  verbose?: boolean;

  /** Sprite sheet configuration. */
  spriteSheet: {
    /** Width of each frame in the sprite sheet. */
    frameWidth: number;
    /** Height of each frame in the sprite sheet. */
    frameHeight: number;
    /** Optional padding between frames in the sprite sheet. */
    padding?: number;
    /** Format of the sprite sheet (must be 'png' or 'webp'). */
    format: 'png' | 'webp';
  };
}

/**
 * Loads a YAML configuration file and returns a ProjectConfig object.
 * @param path - Path to the YAML file.
 * @returns Parsed and validated ProjectConfig object.
 * @throws {Error} If the file cannot be read, YAML is invalid, or required fields are missing.
 */
export function loadConfig(path: string): ProjectConfig {
  const data = readFileSync(path, 'utf-8');
  const config = parseYaml(data);
  validateConfig(config);
  return config as ProjectConfig;
}

/**
 * Creates a default ProjectConfig with sensible values.
 * @returns Default ProjectConfig object.
 */
export function createDefaultConfig(): ProjectConfig {
  return {
    name: 'Default Project',
    outputDir: './outputs',
    character: {
      description: 'A generic character',
      style: 'cartoon',
      referenceImages: [],
    },
    animations: [
      {
        name: 'Idle',
        frames: 12,
        fps: 24,
        poses: ['pose1', 'pose2', 'pose3'],
      },
    ],
    spriteSheet: {
      frameWidth: 64,
      frameHeight: 64,
      format: 'png',
    },
  };
}

/**
 * Validates a config object and throws descriptive errors for missing or invalid fields.
 * @param config - Raw parsed config object to validate.
 * @throws {Error} If required fields are missing or invalid.
 */
function validateConfig(config: Record<string, unknown>): void {
  if (!config || typeof config !== 'object') throw new Error('Config must be an object');
  if (!config.name) throw new Error('Missing required field: name');
  if (!config.outputDir) throw new Error('Missing required field: outputDir');

  const character = config.character as Record<string, unknown> | undefined;
  if (!character) throw new Error('Missing required field: character');
  if (!character.description) throw new Error('Missing required field: character.description');
  if (!character.style) throw new Error('Missing required field: character.style');

  if (!Array.isArray(config.animations)) throw new Error('Missing required field: animations');

  const spriteSheet = config.spriteSheet as Record<string, unknown> | undefined;
  if (!spriteSheet) throw new Error('Missing required field: spriteSheet');
  if (!spriteSheet.frameWidth) throw new Error('Missing required field: spriteSheet.frameWidth');
  if (!isNumber(spriteSheet.frameWidth)) throw new Error('Invalid type for spriteSheet.frameWidth. Must be a number.');
  if (!spriteSheet.frameHeight) throw new Error('Missing required field: spriteSheet.frameHeight');
  if (!isNumber(spriteSheet.frameHeight)) throw new Error('Invalid type for spriteSheet.frameHeight. Must be a number.');
  if (!spriteSheet.format) throw new Error('Missing required field: spriteSheet.format');
  if (typeof spriteSheet.format !== 'string') throw new Error('Invalid type for spriteSheet.format. Must be a string.');
  if (spriteSheet.format !== 'png' && spriteSheet.format !== 'webp') {
    throw new Error('Invalid value for spriteSheet.format. Must be "png" or "webp".');
  }

  function isNumber(value: unknown): boolean {
    return typeof value === 'number' && !isNaN(value);
  }
}
