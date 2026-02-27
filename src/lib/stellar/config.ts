import { rpc, Networks } from "@stellar/stellar-sdk";

// Network configuration
export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;

// Create Soroban RPC client
export function getSorobanClient(): rpc.Server {
  return new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
}

// Network object for Blend SDK
export function getNetwork() {
  return {
    rpc: SOROBAN_RPC_URL,
    passphrase: NETWORK_PASSPHRASE,
    opts: { allowHttp: true },
  };
}
