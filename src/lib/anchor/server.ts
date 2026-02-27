/**
 * Server-side Anchor client initialization
 *
 * Uses real Etherfuse client if API key is configured,
 * otherwise falls back to mock for local development.
 */

import { EtherfuseClient } from "./client";
import { MockAnchorClient } from "./mock";
import { Anchor } from "./types";
import { debug } from "../debug";

let cachedAnchorClient: Anchor | null = null;

export function getAnchorClient(sessionCustomerId?: string): Anchor {
  const apiKey = process.env.ETHERFUSE_API_KEY;
  const baseUrl = process.env.ETHERFUSE_BASE_URL || "https://api.sand.etherfuse.com";
  const useMock = process.env.USE_MOCK_ANCHOR === "true";
  // Persistent IDs from env - MUST match what was used during onboarding
  const envCustomerId = process.env.ETHERFUSE_CUSTOMER_ID;
  const envBankAccountId = process.env.ETHERFUSE_BANK_ACCOUNT_ID;

  // Use session customer ID if provided, otherwise fall back to env
  const customerId = sessionCustomerId || envCustomerId;

  if (useMock) {
    if (!cachedAnchorClient) {
      debug.log("Anchor", "USE_MOCK_ANCHOR=true, using mock client");
      cachedAnchorClient = new MockAnchorClient();
    }
    return cachedAnchorClient;
  }

  if (!apiKey || apiKey === "your_api_key_here") {
    if (!cachedAnchorClient) {
      debug.log("Anchor", "No API key found, using mock client");
      cachedAnchorClient = new MockAnchorClient();
    }
    return cachedAnchorClient;
  }

  // For real Etherfuse client, create new instance when sessionCustomerId is provided
  // to support per-request customer IDs
  if (sessionCustomerId) {
    debug.log("Anchor", "Using session customer ID:", sessionCustomerId);
    return new EtherfuseClient(apiKey, baseUrl, sessionCustomerId, envBankAccountId);
  }

  // Use cached client for default case
  if (!cachedAnchorClient) {
    debug.log("Anchor", "Using real Etherfuse client");
    if (envCustomerId && envBankAccountId) {
      debug.log("Anchor", "Using env IDs - customer:", envCustomerId);
    }
    cachedAnchorClient = new EtherfuseClient(apiKey, baseUrl, envCustomerId, envBankAccountId);
  }

  return cachedAnchorClient;
}

// Get the Etherfuse client specifically (for sandbox-only methods like simulateFiatReceived)
export function getEtherfuseClient(): EtherfuseClient | null {
  const apiKey = process.env.ETHERFUSE_API_KEY;
  const baseUrl = process.env.ETHERFUSE_BASE_URL || "https://api.sand.etherfuse.com";
  const persistentCustomerId = process.env.ETHERFUSE_CUSTOMER_ID;
  const persistentBankAccountId = process.env.ETHERFUSE_BANK_ACCOUNT_ID;

  if (apiKey && apiKey !== "your_api_key_here") {
    return new EtherfuseClient(apiKey, baseUrl, persistentCustomerId, persistentBankAccountId);
  }

  return null;
}
