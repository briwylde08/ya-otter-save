import { z } from "zod";

// Demo state validation - for localStorage data
export const demoStateSchema = z.object({
  cetesBalance: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 1_000_000_000;
  }, "Invalid balance"),
  usdcBalance: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 1_000_000_000;
  }, "Invalid balance"),
  depositedAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 1_000_000_000;
  }, "Invalid amount"),
  estimatedYield: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 1_000_000_000;
  }, "Invalid yield"),
});

// Transaction types
const transactionTypeSchema = z.enum(["onramp", "swap", "deposit", "withdraw", "offramp"]);

// Transaction validation
export const transactionSchema = z.object({
  id: z.string().min(1),
  type: transactionTypeSchema,
  description: z.string().max(500), // Limit length to prevent XSS-like attacks
  hash: z.string().optional(),
  status: z.enum(["pending", "success", "failed"]),
  timestamp: z.string().or(z.date()),
  details: z.string().max(1000).optional(),
});

export const transactionsArraySchema = z.array(transactionSchema).max(1000); // Limit stored transactions

// Helper to safely parse localStorage data
export function safeParseLocalStorage<T>(
  key: string,
  schema: z.ZodSchema<T>,
  defaultValue: T
): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;

    const parsed = JSON.parse(stored);
    const result = schema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    console.warn(`[localStorage] Invalid data for ${key}, using default:`, result.error.issues);
    return defaultValue;
  } catch (e) {
    console.error(`[localStorage] Failed to parse ${key}:`, e);
    return defaultValue;
  }
}

// Stellar public key format (56 characters, starts with G)
const stellarPublicKey = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar public key format");

// Amount validation - positive number, max 12 decimal places, reasonable limits
const amount = z
  .string()
  .refine((val) => {
    // Reject scientific notation
    if (/[eE]/.test(val)) return false;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number")
  .refine((val) => {
    const num = parseFloat(val);
    return num >= 0.0000001; // Minimum 1 stroop equivalent
  }, "Amount too small (minimum 0.0000001)")
  .refine((val) => {
    const num = parseFloat(val);
    return num <= 1_000_000_000; // 1 billion max
  }, "Amount exceeds maximum allowed")
  .refine((val) => {
    // Max 7 decimal places (Stellar precision)
    const parts = val.split(".");
    return !parts[1] || parts[1].length <= 7;
  }, "Too many decimal places (max 7)");

// UUID format
const uuid = z.string().uuid("Invalid UUID format");

// Asset code validation
const assetCode = z
  .string()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9]+$/, "Invalid asset code");

// Quote request validation
export const quoteRequestSchema = z.object({
  sourceAsset: assetCode,
  destinationAsset: assetCode,
  sourceAmount: amount.optional(),
  destinationAmount: amount.optional(),
  publicKey: stellarPublicKey.optional(),
}).refine(
  (data) => data.sourceAmount || data.destinationAmount,
  "Either sourceAmount or destinationAmount is required"
);

// On-ramp request validation
export const onrampRequestSchema = z.object({
  quoteId: uuid,
  destinationAddress: stellarPublicKey,
  customerId: uuid.optional(),
});

// Off-ramp request validation
export const offrampRequestSchema = z.object({
  quoteId: uuid,
  customerId: uuid,
  sourceAddress: stellarPublicKey,
});

// Simulate payment request validation
export const simulatePaymentRequestSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID required"),
});

// Helper to validate and return typed result or error response
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
  return { success: false, error: errors.join(", ") };
}

// Amount validation for components (returns error message or null)
export function validateAmount(
  value: string,
  options?: {
    min?: number;
    max?: number;
    maxDecimals?: number;
    fieldName?: string;
  }
): string | null {
  const { min = 0.0000001, max = 1_000_000_000, maxDecimals = 7, fieldName = "Amount" } = options || {};

  if (!value || value.trim() === "") {
    return `${fieldName} is required`;
  }

  // Reject scientific notation
  if (/[eE]/.test(value)) {
    return `${fieldName} cannot use scientific notation`;
  }

  // Check if it's a valid number
  const num = parseFloat(value);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }

  // Check bounds
  if (num <= 0) {
    return `${fieldName} must be greater than 0`;
  }

  if (num < min) {
    return `${fieldName} is too small (minimum ${min})`;
  }

  if (num > max) {
    return `${fieldName} exceeds maximum (${max.toLocaleString()})`;
  }

  // Check decimal places
  const parts = value.split(".");
  if (parts[1] && parts[1].length > maxDecimals) {
    return `${fieldName} has too many decimal places (max ${maxDecimals})`;
  }

  return null; // Valid
}
