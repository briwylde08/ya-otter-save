import { Asset } from "@stellar/stellar-sdk";

// Asset issuers (Testnet)
export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER ||
  "GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56";

// CETES - Etherfuse Mexican T-Bills (Testnet)
export const CETES_ISSUER =
  process.env.NEXT_PUBLIC_CETES_ISSUER ||
  "GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4";

// Soroban contract ID for CETES (needed for smart contract interactions)
export const CETES_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CETES_CONTRACT_ID ||
  "CC72F57YTPX76HAA64JQOEGHQAPSADQWSY5DWVBR66JINPFDLNCQYHIC";

// Asset definitions
export const XLM = Asset.native();
export const USDC = new Asset("USDC", USDC_ISSUER);
export const CETES = new Asset("CETES", CETES_ISSUER);

// Asset metadata for display
export const ASSET_METADATA: Record<
  string,
  { name: string; symbol: string; decimals: number; icon?: string }
> = {
  native: {
    name: "Stellar Lumens",
    symbol: "XLM",
    decimals: 7,
  },
  [`USDC:${USDC_ISSUER}`]: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 7,
  },
  [`CETES:${CETES_ISSUER}`]: {
    name: "CETES (Mexican T-Bills)",
    symbol: "CETES",
    decimals: 7,
  },
};

// Helper to get asset key for lookups
export function getAssetKey(asset: Asset): string {
  if (asset.isNative()) {
    return "native";
  }
  return `${asset.getCode()}:${asset.getIssuer()}`;
}

// Helper to format balance with decimals
export function formatBalance(amount: string, decimals: number = 7): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

// Helper to convert stroops to units
export function stroopsToUnits(stroops: bigint, decimals: number = 7): string {
  const divisor = BigInt(10 ** decimals);
  const units = Number(stroops) / Number(divisor);
  return units.toFixed(decimals);
}

// Helper to convert units to stroops
export function unitsToStroops(units: string, decimals: number = 7): bigint {
  const multiplier = BigInt(10 ** decimals);
  const parsed = parseFloat(units);
  if (isNaN(parsed)) return BigInt(0);
  return BigInt(Math.floor(parsed * Number(multiplier)));
}
