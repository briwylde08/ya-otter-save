"use client";

import { useState, useEffect } from "react";
import {
  getCetesToUsdcQuote,
  getUsdcToCetesQuote,
  buildCetesToUsdcSwap,
  buildUsdcToCetesSwap,
  SwapQuote,
} from "@/lib/stellar/swap";
import {
  signWithFreighter,
  submitToHorizon,
  hasTrustline,
  buildChangeTrustTx,
} from "@/lib/stellar/transaction";
import { formatBalance, USDC_ISSUER, CETES_ISSUER } from "@/lib/stellar/assets";
import { Asset } from "@stellar/stellar-sdk";
import { validateAmount } from "@/lib/validation";

interface SwapProps {
  publicKey: string;
  direction: "cetes-to-usdc" | "usdc-to-cetes";
  availableBalance: string;
  onComplete: (outputAmount: string, txHash?: string) => void;
}

// Mock exchange rates for demo when no liquidity exists
const MOCK_RATES = {
  "cetes-to-usdc": 0.055, // 1 CETES ≈ $0.055 USD (based on ~18 MXN per CETES, 18 MXN/peso rate)
  "usdc-to-cetes": 18.18, // 1 USDC ≈ 18.18 CETES
};

export function Swap({
  publicKey,
  direction,
  availableBalance,
  onComplete,
}: SwapProps) {
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMockSwap, setUseMockSwap] = useState(false);
  const [hasDestTrustline, setHasDestTrustline] = useState<boolean | null>(null);
  const [isAddingTrustline, setIsAddingTrustline] = useState(false);

  const sourceAsset = direction === "cetes-to-usdc" ? "CETES" : "USDC";
  const destAsset = direction === "cetes-to-usdc" ? "USDC" : "CETES";
  const destIssuer = direction === "cetes-to-usdc" ? USDC_ISSUER : CETES_ISSUER;

  // Check for destination asset trustline on mount
  useEffect(() => {
    const checkTrustline = async () => {
      try {
        const has = await hasTrustline(publicKey, destAsset, destIssuer);
        setHasDestTrustline(has);
      } catch (err) {
        console.error("[Swap] Error checking trustline:", err);
        setHasDestTrustline(false);
      }
    };
    checkTrustline();
  }, [publicKey, destAsset, destIssuer]);

  const handleAddTrustline = async () => {
    setIsAddingTrustline(true);
    setError(null);

    try {
      const asset = new Asset(destAsset, destIssuer);
      const xdr = await buildChangeTrustTx(publicKey, asset);
      const signedXdr = await signWithFreighter(xdr, publicKey);
      const result = await submitToHorizon(signedXdr);

      if (result.success) {
        setHasDestTrustline(true);
      } else {
        throw new Error(result.error || "Failed to add trustline");
      }
    } catch (err) {
      console.error("[Swap] Error adding trustline:", err);
      setError(err instanceof Error ? err.message : "Failed to add trustline");
    } finally {
      setIsAddingTrustline(false);
    }
  };

  // Fetch quote when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      // Validate amount
      const amountError = validateAmount(amount, {
        min: 0.0000001,
        max: parseFloat(availableBalance) || 1_000_000,
        maxDecimals: 7,
        fieldName: "Amount"
      });
      if (amountError) {
        setQuote(null);
        setUseMockSwap(false);
        if (amount && amount.trim() !== "") {
          setError(amountError);
        }
        return;
      }
      setError(null);

      setIsLoading(true);
      setError(null);

      try {
        const newQuote =
          direction === "cetes-to-usdc"
            ? await getCetesToUsdcQuote(amount)
            : await getUsdcToCetesQuote(amount);

        if (newQuote) {
          setQuote(newQuote);
          setUseMockSwap(false);
        } else {
          // No real liquidity - use mock quote for demo
          const mockRate = MOCK_RATES[direction];
          const mockOutput = (parseFloat(amount) * mockRate).toFixed(7);
          setQuote({
            sourceAmount: amount,
            destinationAmount: mockOutput,
            path: [],
            rate: mockRate,
          });
          setUseMockSwap(true);
        }
      } catch (err) {
        console.error("[Swap] Error fetching quote:", err);
        // Fallback to mock on error too
        const mockRate = MOCK_RATES[direction];
        const mockOutput = (parseFloat(amount) * mockRate).toFixed(7);
        setQuote({
          sourceAmount: amount,
          destinationAmount: mockOutput,
          path: [],
          rate: mockRate,
        });
        setUseMockSwap(true);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [amount, direction]);

  const handleSwap = async () => {
    if (!quote || !amount) return;

    setIsSwapping(true);
    setError(null);

    try {
      if (useMockSwap) {
        // Demo mode: simulate swap without real transaction
        await new Promise((resolve) => setTimeout(resolve, 1500));
        onComplete(quote.destinationAmount, undefined);
        return;
      }

      // Build swap transaction
      const result =
        direction === "cetes-to-usdc"
          ? await buildCetesToUsdcSwap(publicKey, amount)
          : await buildUsdcToCetesSwap(publicKey, amount);

      if (!result) {
        throw new Error("Failed to build swap transaction");
      }

      // Sign with Freighter
      const signedXdr = await signWithFreighter(result.xdr, publicKey);

      // Submit to network
      const submitResult = await submitToHorizon(signedXdr);

      if (submitResult.success) {
        onComplete(quote.destinationAmount, submitResult.hash);
      } else {
        throw new Error(submitResult.error || "Swap failed");
      }
    } catch (err) {
      console.error("[Swap] Error:", err);
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(availableBalance);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Swap {sourceAsset} to {destAsset}
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {direction === "cetes-to-usdc"
          ? "Swap your CETES to USDC to deposit into Blend and earn yield."
          : "Swap your USDC back to CETES for off-ramping to MXN."}
      </p>

      {/* Trustline Check */}
      {hasDestTrustline === null && (
        <div className="text-center py-4">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Checking wallet setup...
          </p>
        </div>
      )}

      {hasDestTrustline === false && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              {destAsset} Trustline Required
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              To receive {destAsset} from this swap, your wallet needs to trust the {destAsset} asset.
              This is a one-time setup that requires a small network fee.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleAddTrustline}
            disabled={isAddingTrustline}
            className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {isAddingTrustline ? "Adding Trustline..." : `Add ${destAsset} Trustline`}
          </button>
        </div>
      )}

      {/* Input Amount - only show if trustline exists */}
      {hasDestTrustline && (
      <>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {sourceAsset} Amount
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            min="0"
            step="0.0000001"
          />
          <button
            onClick={handleMaxAmount}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded hover:bg-cyan-200 dark:hover:bg-cyan-800"
          >
            MAX
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Available: {formatBalance(availableBalance)} {sourceAsset}
        </p>
      </div>

      {/* Quote Display */}
      {isLoading && (
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Fetching quote...
          </p>
        </div>
      )}

      {quote && !isLoading && (
        <div className="mb-4 p-4 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg">
          {useMockSwap && (
            <div className="mb-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
              Demo Mode: No DEX liquidity on testnet
            </div>
          )}
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              You receive
            </span>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatBalance(quote.destinationAmount)} {destAsset}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400">Rate</span>
            <span className="text-gray-700 dark:text-gray-300">
              1 {sourceAsset} = {quote.rate.toFixed(4)} {destAsset}
            </span>
          </div>
          {quote.path.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Route: {sourceAsset} → {quote.path.map((a) => a.getCode()).join(" → ")} → {destAsset}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!quote || isSwapping || isLoading}
        className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {isSwapping ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Swapping...
          </span>
        ) : useMockSwap ? (
          `Simulate Swap (Demo)`
        ) : (
          `Swap ${sourceAsset} to ${destAsset}`
        )}
      </button>
      </>
      )}
    </div>
  );
}
