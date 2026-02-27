/**
 * Stellar DEX Swap Integration
 *
 * Uses Horizon's strict_send_paths and strict_receive_paths to find
 * optimal swap routes between assets.
 */

import {
  Asset,
  Operation,
  TransactionBuilder,
  Account,
} from "@stellar/stellar-sdk";
import { HORIZON_URL, NETWORK_PASSPHRASE } from "./config";
import { CETES, USDC, CETES_ISSUER } from "./assets";

const BASE_FEE = "100000";
const TIMEOUT_SECONDS = 180;

export interface SwapPath {
  sourceAsset: Asset;
  sourceAmount: string;
  destinationAsset: Asset;
  destinationAmount: string;
  path: Asset[];
}

export interface SwapQuote {
  sourceAmount: string;
  destinationAmount: string;
  path: Asset[];
  rate: number;
}

/**
 * Find paths for swapping using strict send (exact input amount)
 * Uses Horizon's /paths/strict-send endpoint
 */
export async function findStrictSendPaths(
  sourceAsset: Asset,
  sourceAmount: string,
  destinationAsset: Asset
): Promise<SwapPath[]> {
  const sourceAssetParam = sourceAsset.isNative()
    ? "native"
    : `${sourceAsset.getCode()}:${sourceAsset.getIssuer()}`;

  const destAssetParam = destinationAsset.isNative()
    ? "native"
    : `${destinationAsset.getCode()}:${destinationAsset.getIssuer()}`;

  const url = new URL(`${HORIZON_URL}/paths/strict-send`);
  const sourceAssetType = sourceAsset.isNative()
    ? "native"
    : sourceAsset.getCode().length <= 4
      ? "credit_alphanum4"
      : "credit_alphanum12";
  url.searchParams.set("source_asset_type", sourceAssetType);
  if (!sourceAsset.isNative()) {
    url.searchParams.set("source_asset_code", sourceAsset.getCode());
    url.searchParams.set("source_asset_issuer", sourceAsset.getIssuer());
  }
  url.searchParams.set("source_amount", sourceAmount);
  url.searchParams.set("destination_assets", destAssetParam);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to find swap paths: ${response.statusText}`);
  }

  const data = await response.json();

  return data._embedded?.records?.map((record: any) => ({
    sourceAsset,
    sourceAmount: record.source_amount,
    destinationAsset,
    destinationAmount: record.destination_amount,
    path: record.path?.map((p: any) =>
      p.asset_type === "native"
        ? Asset.native()
        : new Asset(p.asset_code, p.asset_issuer)
    ) || [],
  })) || [];
}

/**
 * Find paths for swapping using strict receive (exact output amount)
 * Uses Horizon's /paths/strict-receive endpoint
 */
export async function findStrictReceivePaths(
  sourceAsset: Asset,
  destinationAsset: Asset,
  destinationAmount: string
): Promise<SwapPath[]> {
  const sourceAssetParam = sourceAsset.isNative()
    ? "native"
    : `${sourceAsset.getCode()}:${sourceAsset.getIssuer()}`;

  const url = new URL(`${HORIZON_URL}/paths/strict-receive`);
  url.searchParams.set("source_assets", sourceAssetParam);
  const destAssetType = destinationAsset.isNative()
    ? "native"
    : destinationAsset.getCode().length <= 4
      ? "credit_alphanum4"
      : "credit_alphanum12";
  url.searchParams.set("destination_asset_type", destAssetType);
  if (!destinationAsset.isNative()) {
    url.searchParams.set("destination_asset_code", destinationAsset.getCode());
    url.searchParams.set("destination_asset_issuer", destinationAsset.getIssuer());
  }
  url.searchParams.set("destination_amount", destinationAmount);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to find swap paths: ${response.statusText}`);
  }

  const data = await response.json();

  return data._embedded?.records?.map((record: any) => ({
    sourceAsset,
    sourceAmount: record.source_amount,
    destinationAsset,
    destinationAmount: record.destination_amount,
    path: record.path?.map((p: any) =>
      p.asset_type === "native"
        ? Asset.native()
        : new Asset(p.asset_code, p.asset_issuer)
    ) || [],
  })) || [];
}

/**
 * Get a swap quote for CETES -> USDC
 */
export async function getCetesToUsdcQuote(
  cetesAmount: string
): Promise<SwapQuote | null> {
  try {
    const paths = await findStrictSendPaths(CETES, cetesAmount, USDC);

    if (paths.length === 0) {
      console.warn("[Swap] No paths found for CETES -> USDC");
      return null;
    }

    // Return the best path (first one, usually best rate)
    const best = paths[0];
    const rate =
      parseFloat(best.destinationAmount) / parseFloat(best.sourceAmount);

    return {
      sourceAmount: best.sourceAmount,
      destinationAmount: best.destinationAmount,
      path: best.path,
      rate,
    };
  } catch (error) {
    console.error("[Swap] Error getting CETES -> USDC quote:", error);
    return null;
  }
}

/**
 * Get a swap quote for USDC -> CETES
 */
export async function getUsdcToCetesQuote(
  usdcAmount: string
): Promise<SwapQuote | null> {
  try {
    const paths = await findStrictSendPaths(USDC, usdcAmount, CETES);

    if (paths.length === 0) {
      console.warn("[Swap] No paths found for USDC -> CETES");
      return null;
    }

    const best = paths[0];
    const rate =
      parseFloat(best.destinationAmount) / parseFloat(best.sourceAmount);

    return {
      sourceAmount: best.sourceAmount,
      destinationAmount: best.destinationAmount,
      path: best.path,
      rate,
    };
  } catch (error) {
    console.error("[Swap] Error getting USDC -> CETES quote:", error);
    return null;
  }
}

/**
 * Build a path payment strict send transaction
 */
export async function buildSwapTransaction(
  sourcePublicKey: string,
  sourceAsset: Asset,
  sourceAmount: string,
  destinationAsset: Asset,
  minDestinationAmount: string,
  path: Asset[]
): Promise<string> {
  // Fetch account
  const response = await fetch(`${HORIZON_URL}/accounts/${sourcePublicKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.statusText}`);
  }
  const accountData = await response.json();
  const account = new Account(sourcePublicKey, accountData.sequence);

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  builder.addOperation(
    Operation.pathPaymentStrictSend({
      sendAsset: sourceAsset,
      sendAmount: sourceAmount,
      destination: sourcePublicKey, // Swap to self
      destAsset: destinationAsset,
      destMin: minDestinationAmount,
      path: path,
    })
  );

  builder.setTimeout(TIMEOUT_SECONDS);

  return builder.build().toXDR();
}

/**
 * Build CETES -> USDC swap transaction
 */
export async function buildCetesToUsdcSwap(
  publicKey: string,
  cetesAmount: string,
  slippageBps: number = 100 // 1% default slippage
): Promise<{ xdr: string; quote: SwapQuote } | null> {
  const quote = await getCetesToUsdcQuote(cetesAmount);

  if (!quote) {
    return null;
  }

  // Apply slippage to minimum output
  const minOutput = (
    parseFloat(quote.destinationAmount) *
    (1 - slippageBps / 10000)
  ).toFixed(7);

  const xdr = await buildSwapTransaction(
    publicKey,
    CETES,
    cetesAmount,
    USDC,
    minOutput,
    quote.path
  );

  return { xdr, quote };
}

/**
 * Build USDC -> CETES swap transaction
 */
export async function buildUsdcToCetesSwap(
  publicKey: string,
  usdcAmount: string,
  slippageBps: number = 100
): Promise<{ xdr: string; quote: SwapQuote } | null> {
  const quote = await getUsdcToCetesQuote(usdcAmount);

  if (!quote) {
    return null;
  }

  const minOutput = (
    parseFloat(quote.destinationAmount) *
    (1 - slippageBps / 10000)
  ).toFixed(7);

  const xdr = await buildSwapTransaction(
    publicKey,
    USDC,
    usdcAmount,
    CETES,
    minOutput,
    quote.path
  );

  return { xdr, quote };
}
