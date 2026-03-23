import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, now, elapsed } from '../../src/utils/logger';

describe('Logger', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  describe('log()', () => {
    it('should write a timestamped line to stdout', () => {
      log('normalize', 'Processing 8 frames...');
      expect(writeSpy).toHaveBeenCalledOnce();
      const output = writeSpy.mock.calls[0][0] as string;
      expect(output).toMatch(/^\[\d{2}:\d{2}:\d{2}\] \[normalize\] Processing 8 frames\.\.\.\n$/);
    });

    it('should include step and message in the output', () => {
      log('atlas', 'Packing 4 cols × 4 rows');
      const output = writeSpy.mock.calls[0][0] as string;
      expect(output).toContain('[atlas]');
      expect(output).toContain('Packing 4 cols × 4 rows');
    });

    it('should write to stdout not stderr', () => {
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      log('load', 'test');
      expect(writeSpy).toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();
      stderrSpy.mockRestore();
    });

    it('should end each log line with a newline', () => {
      log('done', 'All finished');
      const output = writeSpy.mock.calls[0][0] as string;
      expect(output).toMatch(/\n$/);
    });
  });

  describe('now() and elapsed()', () => {
    it('now() should return a positive number', () => {
      const t = now();
      expect(typeof t).toBe('number');
      expect(t).toBeGreaterThan(0);
    });

    it('elapsed() should return a string formatted to one decimal', () => {
      const start = now();
      const result = elapsed(start);
      expect(result).toMatch(/^\d+\.\d$/);
    });

    it('elapsed() should reflect real time passing', async () => {
      const start = now();
      await new Promise((r) => setTimeout(r, 50));
      const secs = parseFloat(elapsed(start));
      expect(secs).toBeGreaterThanOrEqual(0.0);
    });
  });
});
