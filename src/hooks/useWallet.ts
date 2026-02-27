"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  isAllowed,
  setAllowed,
  getNetwork,
} from "@stellar/freighter-api";
import { fetchBalances } from "@/lib/stellar/transaction";
import { NETWORK } from "@/lib/stellar/config";

export interface WalletState {
  isConnected: boolean;
  isAllowed: boolean;
  publicKey: string | null;
  network: string | null;
  balances: Array<{ asset: string; balance: string }>;
  isLoading: boolean;
  error: string | null;
}

export interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalances: () => Promise<void>;
}

export function useWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isAllowed: false,
    publicKey: null,
    network: null,
    balances: [],
    isLoading: true,
    error: null,
  });

  // Check initial connection state
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await isConnected();

        if (!connected.isConnected) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isConnected: false,
          }));
          return;
        }

        const allowed = await isAllowed();

        if (!allowed.isAllowed) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isConnected: true,
            isAllowed: false,
          }));
          return;
        }

        // Get public key and network
        const addressResult = await getAddress();
        const networkResult = await getNetwork();

        // Verify we're on the right network
        const isCorrectNetwork =
          networkResult.network === NETWORK ||
          networkResult.networkPassphrase?.includes("Test");

        if (!isCorrectNetwork) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: `Please switch to ${NETWORK} in Freighter`,
          }));
          return;
        }

        // Fetch balances
        const balances = await fetchBalances(addressResult.address);

        setState({
          isConnected: true,
          isAllowed: true,
          publicKey: addressResult.address,
          network: networkResult.network,
          balances,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("[useWallet] Error checking connection:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to check wallet connection",
        }));
      }
    };

    checkConnection();
  }, []);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check if Freighter is installed
      const connected = await isConnected();

      if (!connected.isConnected) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Please install Freighter wallet extension",
        }));
        return;
      }

      // Request permission
      await setAllowed();

      // Get public key
      const addressResult = await getAddress();
      const networkResult = await getNetwork();

      // Verify network
      const isCorrectNetwork =
        networkResult.network === NETWORK ||
        networkResult.networkPassphrase?.includes("Test");

      if (!isCorrectNetwork) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isConnected: true,
          isAllowed: true,
          publicKey: addressResult.address,
          network: networkResult.network,
          error: `Please switch to ${NETWORK} in Freighter`,
        }));
        return;
      }

      // Fetch balances
      const balances = await fetchBalances(addressResult.address);

      setState({
        isConnected: true,
        isAllowed: true,
        publicKey: addressResult.address,
        network: networkResult.network,
        balances,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("[useWallet] Error connecting:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to connect wallet",
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      isAllowed: false,
      publicKey: null,
      network: null,
      balances: [],
      isLoading: false,
      error: null,
    });
  }, []);

  const refreshBalances = useCallback(async () => {
    if (!state.publicKey) return;

    try {
      const balances = await fetchBalances(state.publicKey);
      setState((prev) => ({ ...prev, balances }));
    } catch (error) {
      console.error("[useWallet] Error refreshing balances:", error);
    }
  }, [state.publicKey]);

  return {
    ...state,
    connect,
    disconnect,
    refreshBalances,
  };
}
