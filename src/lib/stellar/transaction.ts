import {
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  Account,
  rpc,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { getSorobanClient, NETWORK_PASSPHRASE, HORIZON_URL } from "./config";

const BASE_FEE = "100000"; // 0.01 XLM - generous for testnet
const TIMEOUT_SECONDS = 180;

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
  resultXdr?: string;
}

// Fetch account from Horizon
export async function fetchAccount(publicKey: string): Promise<Account> {
  const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.statusText}`);
  }
  const data = await response.json();
  return new Account(publicKey, data.sequence);
}

// Fetch account balances
export async function fetchBalances(
  publicKey: string
): Promise<Array<{ asset: string; balance: string }>> {
  const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
  if (!response.ok) {
    if (response.status === 404) {
      // Account not funded yet
      return [{ asset: "native", balance: "0" }];
    }
    throw new Error(`Failed to fetch balances: ${response.statusText}`);
  }
  const data = await response.json();

  return data.balances.map(
    (b: { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string }) => {
      if (b.asset_type === "native") {
        return { asset: "native", balance: b.balance };
      }
      return {
        asset: `${b.asset_code}:${b.asset_issuer}`,
        balance: b.balance,
      };
    }
  );
}

// Check if account has a trustline for a specific asset
export async function hasTrustline(
  publicKey: string,
  assetCode: string,
  assetIssuer: string
): Promise<boolean> {
  const balances = await fetchBalances(publicKey);
  const assetKey = `${assetCode}:${assetIssuer}`;
  return balances.some((b) => b.asset === assetKey);
}

// Build a simple payment transaction
export async function buildPaymentTx(
  sourcePublicKey: string,
  destinationPublicKey: string,
  asset: Asset,
  amount: string,
  memo?: string
): Promise<string> {
  const account = await fetchAccount(sourcePublicKey);

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  builder.addOperation(
    Operation.payment({
      destination: destinationPublicKey,
      asset: asset,
      amount: amount,
    })
  );

  if (memo) {
    builder.addMemo(Memo.text(memo));
  }

  builder.setTimeout(TIMEOUT_SECONDS);

  return builder.build().toXDR();
}

// Build a change trust transaction (for adding trustlines)
export async function buildChangeTrustTx(
  sourcePublicKey: string,
  asset: Asset,
  limit?: string
): Promise<string> {
  const account = await fetchAccount(sourcePublicKey);

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  builder.addOperation(
    Operation.changeTrust({
      asset: asset,
      limit: limit,
    })
  );

  builder.setTimeout(TIMEOUT_SECONDS);

  return builder.build().toXDR();
}

// Sign transaction with Freighter
export async function signWithFreighter(
  txXdr: string,
  publicKey: string
): Promise<string> {
  const result = await signTransaction(txXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: publicKey,
  });

  // Check for error
  if (result.error) {
    throw new Error(result.error.message || "Failed to sign transaction");
  }

  return result.signedTxXdr;
}

// Submit transaction to Horizon
export async function submitToHorizon(
  signedXdr: string
): Promise<TransactionResult> {
  try {
    const response = await fetch(`${HORIZON_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `tx=${encodeURIComponent(signedXdr)}`,
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        hash: data.hash,
        resultXdr: data.result_xdr,
      };
    } else {
      return {
        success: false,
        error: data.extras?.result_codes?.operations?.join(", ") || data.title || "Transaction failed",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Simulate and submit Soroban transaction
export async function simulateAndSubmitSoroban(
  txXdr: string,
  publicKey: string
): Promise<TransactionResult> {
  const server = getSorobanClient();

  try {
    // Parse the transaction
    const tx = TransactionBuilder.fromXDR(txXdr, NETWORK_PASSPHRASE);

    // Simulate first
    const simResult = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      return {
        success: false,
        error: simResult.error || "Simulation failed",
      };
    }

    // Prepare the transaction with simulation results
    const preparedTx = rpc.assembleTransaction(
      tx,
      simResult
    ).build();

    // Sign with Freighter
    const signedXdr = await signWithFreighter(preparedTx.toXDR(), publicKey);

    // Submit
    const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    const submitResult = await server.sendTransaction(signedTx);

    if (submitResult.status === "ERROR") {
      return {
        success: false,
        error: "Transaction submission failed",
      };
    }

    // Poll for result with max retries to prevent infinite loop
    const hash = submitResult.hash;
    const MAX_POLL_ATTEMPTS = 60; // 60 seconds max
    let pollAttempts = 0;
    let getResult = await server.getTransaction(hash);

    while (getResult.status === "NOT_FOUND" && pollAttempts < MAX_POLL_ATTEMPTS) {
      pollAttempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getResult = await server.getTransaction(hash);
    }

    if (getResult.status === "NOT_FOUND") {
      return {
        success: false,
        hash: hash,
        error: "Transaction confirmation timed out - check Stellar Explorer for status",
      };
    }

    if (getResult.status === "SUCCESS") {
      return {
        success: true,
        hash: hash,
        resultXdr: getResult.resultXdr?.toXDR("base64"),
      };
    } else {
      return {
        success: false,
        hash: hash,
        error: "Transaction failed on-chain",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
