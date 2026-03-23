import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

/**
 * Helper to run the CLI via tsx (TypeScript execution) and capture output.
 * Returns { stdout, stderr, exitCode }.
 */
function runCli(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const CLI_PATH = join(process.cwd(), 'src/cli/index.ts');
  try {
    const stdout = execSync(`npx tsx ${CLI_PATH} ${args}`, {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

/**
 * Creates simple PNG frame files in the given directory using sharp.
 */
async function createFrames(dir: string, count: number): Promise<void> {
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < count; i++) {
    const name = `frame_${String(i + 1).padStart(3, '0')}.png`;
    await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 100, g: 150, b: 200, alpha: 1 },
      },
    })
      .png()
      .toFile(join(dir, name));
  }
}

describe('CLI: init command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cli-init-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create animation.yaml with default content', () => {
    const outputPath = join(tempDir, 'animation.yaml');
    const result = runCli(`init --output ${outputPath}`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created config');
    expect(existsSync(outputPath)).toBe(true);

    const content = readFileSync(outputPath, 'utf-8');
    const config = parseYaml(content);
    expect(config.name).toBe('Default Project');
    expect(config.spriteSheet.format).toBe('png');
  });

  it('should print the output path in the success message', () => {
    const outputPath = join(tempDir, 'my-anim.yaml');
    const result = runCli(`init --output ${outputPath}`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(outputPath);
  });

  it('should produce valid YAML parseable by loadConfig', async () => {
    const outputPath = join(tempDir, 'animation.yaml');
    runCli(`init --output ${outputPath}`);

    // Import loadConfig via ES dynamic import
    const { loadConfig } = await import('../../src/pipeline/config.js');
    expect(() => loadConfig(outputPath)).not.toThrow();
  });
});

describe('CLI: generate command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cli-gen-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should error with missing --config flag', () => {
    const result = runCli('generate');
    expect(result.exitCode).not.toBe(0);
    // Commander prints "required option" error
    expect(result.stderr + result.stdout).toMatch(/config/i);
  });

  it('should error when config file does not exist', () => {
    const result = runCli('generate --config /nonexistent/path.yaml');
    expect(result.exitCode).toBe(1);
    expect(result.stderr + result.stdout).toMatch(/not found/i);
  });

  it('should run pipeline and print success for a valid config', async () => {
    // Create frames
    const framesDir = join(tempDir, 'frames');
    await createFrames(framesDir, 4);

    // Write a minimal config
    const configPath = join(tempDir, 'animation.yaml');
    const configYaml = `
name: CLI Test Project
outputDir: ${tempDir}
character:
  description: Test character
  style: cartoon
animations:
  - name: Walk
    frames: 4
    fps: 12
    poses: [a, b, c, d]
spriteSheet:
  frameWidth: 32
  frameHeight: 32
  format: png
`;
    writeFileSync(configPath, configYaml, 'utf-8');

    const result = runCli(`generate --config ${configPath}`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('4 frames');
    expect(result.stdout).toContain('spritesheet.png');
  });
});
