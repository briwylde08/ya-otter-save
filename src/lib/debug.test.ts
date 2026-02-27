import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('debug utility', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('error logging', () => {
    it('always logs errors regardless of debug setting', async () => {
      // Import fresh module
      const { debug } = await import('./debug');

      debug.error('Test', 'error message');

      expect(console.error).toHaveBeenCalled();
    });

    it('extracts message from Error objects', async () => {
      const { debug } = await import('./debug');

      const error = new Error('Something went wrong');
      debug.error('Test', 'An error occurred:', error);

      expect(console.error).toHaveBeenCalledWith('[Test] An error occurred:', 'Something went wrong');
    });

    it('redacts sensitive data in errors when not Error instance', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'Error data:', { apiKey: 'secret123' });

      expect(console.error).toHaveBeenCalledWith('[Test] Error data:', { apiKey: '[REDACTED]' });
    });
  });

  describe('redactSensitive function behavior', () => {
    // Test the redaction logic directly by checking error output
    // (errors always log, so we can test redaction this way)

    it('redacts apiKey fields', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'data:', { name: 'test', apiKey: 'secret-api-key-12345' });

      expect(console.error).toHaveBeenCalledWith('[Test] data:', {
        name: 'test',
        apiKey: '[REDACTED]',
      });
    });

    it('redacts password fields', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'data:', { username: 'user', password: 'super-secret' });

      expect(console.error).toHaveBeenCalledWith('[Test] data:', {
        username: 'user',
        password: '[REDACTED]',
      });
    });

    it('redacts clabe (bank account) fields', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'data:', { bank: 'Test Bank', clabe: '012345678901234567' });

      expect(console.error).toHaveBeenCalledWith('[Test] data:', {
        bank: 'Test Bank',
        clabe: '[REDACTED]',
      });
    });

    it('redacts token fields', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'data:', { user: 'john', token: 'bearer-token-xyz' });

      expect(console.error).toHaveBeenCalledWith('[Test] data:', {
        user: 'john',
        token: '[REDACTED]',
      });
    });

    it('redacts bankAccountId fields', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'data:', { type: 'account', bankAccountId: '12345' });

      expect(console.error).toHaveBeenCalledWith('[Test] data:', {
        type: 'account',
        bankAccountId: '[REDACTED]',
      });
    });

    it('redacts nested sensitive fields', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'data:', {
        user: {
          name: 'John',
          credentials: {
            apiKey: 'secret',
            token: 'bearer-token',
          },
        },
      });

      expect(console.error).toHaveBeenCalledWith('[Test] data:', {
        user: {
          name: 'John',
          credentials: {
            apiKey: '[REDACTED]',
            token: '[REDACTED]',
          },
        },
      });
    });

    it('handles arrays with sensitive data', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'data:', [
        { id: 1, password: 'pass1' },
        { id: 2, password: 'pass2' },
      ]);

      expect(console.error).toHaveBeenCalledWith('[Test] data:', [
        { id: 1, password: '[REDACTED]' },
        { id: 2, password: '[REDACTED]' },
      ]);
    });

    it('handles null gracefully', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'null:', null);

      expect(console.error).toHaveBeenCalledWith('[Test] null:', null);
    });

    it('handles undefined gracefully', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'undefined value');

      expect(console.error).toHaveBeenCalledWith('[Test] undefined value');
    });

    it('handles primitive values', async () => {
      const { debug } = await import('./debug');

      debug.error('Test', 'number:', 42);
      debug.error('Test', 'string:', 'hello');
      debug.error('Test', 'boolean:', true);

      expect(console.error).toHaveBeenCalledWith('[Test] number:', 42);
      expect(console.error).toHaveBeenCalledWith('[Test] string:', 'hello');
      expect(console.error).toHaveBeenCalledWith('[Test] boolean:', true);
    });
  });

  describe('log prefix formatting', () => {
    it('formats prefix correctly in error messages', async () => {
      const { debug } = await import('./debug');

      debug.error('MyModule', 'Something happened');

      expect(console.error).toHaveBeenCalledWith('[MyModule] Something happened');
    });
  });
});
