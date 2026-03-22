import { describe, it, expect } from 'vitest';
import { loadConfig, createDefaultConfig } from '../src/pipeline/config';

describe('Config System', () => {
  it('should load a valid YAML config', () => {
    const config = loadConfig('examples/sample-project.yaml');
    expect(config.name).toBe('Sample Animation Project');
    expect(config.outputDir).toBe('./animations');
    expect(config.character.description).toBe('A friendly cartoon character');
    expect(config.character.style).toBe('cartoon');
    expect(config.character.referenceImages).toEqual(['character_ref1.png', 'character_ref2.png']);
    expect(config.animations.length).toBe(2);
    expect(config.spriteSheet.frameWidth).toBe(128);
    expect(config.spriteSheet.frameHeight).toBe(128);
    expect(config.spriteSheet.format).toBe('webp');
  });

  it('should create a default config with all required fields', () => {
    const config = createDefaultConfig();
    expect(config.name).toBe('Default Project');
    expect(config.outputDir).toBe('./outputs');
    expect(config.character.description).toBe('A generic character');
    expect(config.character.style).toBe('cartoon');
    expect(config.animations.length).toBe(1);
    expect(config.spriteSheet.frameWidth).toBe(64);
    expect(config.spriteSheet.frameHeight).toBe(64);
    expect(config.spriteSheet.format).toBe('png');
  });

  it('should throw error for missing required fields', () => {
    expect(() => loadConfig('examples/invalid-config.yaml')).toThrow(
      'Missing required field: name'
    );
  });

  it('should throw error for invalid sprite sheet format', () => {
    expect(() => loadConfig('examples/invalid-format.yaml')).toThrow(
      'Invalid value for spriteSheet.format. Must be "png" or "webp".'
    );
  });
});
