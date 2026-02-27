/**
 * Debug logging utility
 *
 * Only logs when NEXT_PUBLIC_DEBUG=true or NODE_ENV=development
 * Never logs sensitive data in production
 */

const isDebugEnabled = () => {
  if (typeof window !== "undefined") {
    // Client-side
    return process.env.NEXT_PUBLIC_DEBUG === "true";
  }
  // Server-side
  return process.env.DEBUG === "true" || process.env.NODE_ENV === "development";
};

// Redact sensitive fields from objects before logging
function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitive);
  }

  const sensitiveKeys = [
    "apiKey",
    "api_key",
    "password",
    "secret",
    "token",
    "authorization",
    "clabe",
    "bankAccountId",
    "bank_account_id",
  ];

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitive(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const debug = {
  log: (prefix: string, message: string, data?: unknown) => {
    if (!isDebugEnabled()) return;
    if (data !== undefined) {
      console.log(`[${prefix}] ${message}`, redactSensitive(data));
    } else {
      console.log(`[${prefix}] ${message}`);
    }
  },

  warn: (prefix: string, message: string, data?: unknown) => {
    if (!isDebugEnabled()) return;
    if (data !== undefined) {
      console.warn(`[${prefix}] ${message}`, redactSensitive(data));
    } else {
      console.warn(`[${prefix}] ${message}`);
    }
  },

  error: (prefix: string, message: string, error?: unknown) => {
    // Always log errors, but redact sensitive data
    if (error !== undefined) {
      console.error(`[${prefix}] ${message}`, error instanceof Error ? error.message : redactSensitive(error));
    } else {
      console.error(`[${prefix}] ${message}`);
    }
  },
};
