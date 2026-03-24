#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import { loadConfig, createDefaultConfig } from '../pipeline/config.js';
import { runPipeline } from '../pipeline/runner.js';

const program = new Command();

program
  .name('animate')
  .description('AI Animation Pipeline — generate sprite sheets from AI frames')
  .version('0.1.0');

/**
 * `generate` subcommand: runs the full pipeline given a config file.
 * Usage: animate generate --config <path>
 */
program
  .command('generate')
  .description('Run the animation pipeline using a YAML config file')
  .requiredOption('-c, --config <path>', 'Path to the animation YAML config file')
  .action(async (options: { config: string }) => {
    const configPath = resolve(options.config);

    if (!existsSync(configPath)) {
      console.error(`Error: Config file not found: ${configPath}`);
      process.exit(1);
    }

    let config;
    try {
      config = loadConfig(configPath);
    } catch (err) {
      console.error(`Error: Failed to load config: ${(err as Error).message}`);
      process.exit(1);
    }

    try {
      const result = await runPipeline(config);
      console.log(`✓ Processed ${result.framesProcessed} frames`);
      console.log(`✓ Sprite sheet: ${result.spriteSheetPath}`);
      for (const gifPath of result.gifPaths) {
        console.log(`✓ GIF: ${gifPath}`);
      }
    } catch (err) {
      console.error(`Error: Pipeline failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

/**
 * `init` subcommand: writes a starter animation.yaml with sensible defaults.
 * Usage: animate init
 */
program
  .command('init')
  .description('Create a starter animation.yaml config file in the current directory')
  .option('-o, --output <path>', 'Output path for the config file', './animation.yaml')
  .action((options: { output: string }) => {
    const outputPath = resolve(options.output);

    const config = createDefaultConfig();
    const yaml = yamlStringify(config);

    try {
      writeFileSync(outputPath, yaml, 'utf-8');
      console.log(`✓ Created config: ${outputPath}`);
    } catch (err) {
      console.error(`Error: Could not write config: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
