"use client";

import { useState } from "react";
import { blendClient } from "@/lib/blend/client";
import { formatBalance } from "@/lib/stellar/assets";
import { validateAmount } from "@/lib/validation";

interface BlendDepositProps {
  publicKey: string;
  availableBalance: string;
  onComplete: (depositedAmount: string, txHash?: string) => void;
}

// Note: On testnet, Blend pools use different USDC than DEX USDC.
// This is a known testnet integration gap - see TESTNET_GAPS.md
// On mainnet, all protocols use the same Circle USDC, so this would work.
const USE_MOCK_MODE = true;

export function BlendDeposit({
  publicKey,
  availableBalance,
  onComplete,
}: BlendDepositProps) {
  const [amount, setAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeposit = async () => {
    const amountError = validateAmount(amount, {
      min: 0.0000001,
      max: parseFloat(availableBalance) || 0,
      maxDecimals: 7,
      fieldName: "Deposit amount"
    });
    if (amountError) {
      setError(amountError);
      return;
    }

    setIsDepositing(true);
    setError(null);

    try {
      if (USE_MOCK_MODE) {
        // Demo mode: simulate deposit (testnet USDC mismatch - see TESTNET_GAPS.md)
        await new Promise((resolve) => setTimeout(resolve, 1500));
        onComplete(amount, undefined);
        return;
      }

      // Real mode would go here - disabled due to testnet asset fragmentation
      // const amountStroops = unitsToStroops(amount);
      // const opXdr = await blendClient.buildUsdcSupplyOp(publicKey, amountStroops);
      // const result = await simulateAndSubmitSoroban(opXdr, publicKey);
      // ...
    } catch (err) {
      console.error("[BlendDeposit] Error:", err);
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(availableBalance);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Deposit USDC to Blend
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Supply your USDC to the Blend lending pool to earn yield. Your deposit
        will accrue interest over time.
      </p>

      {/* Pool Info */}
      <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-2xl">🏦</span>
          <span className="font-medium text-gray-900 dark:text-white">
            Blend Testnet Pool
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
          {blendClient.getPoolId().slice(0, 20)}...
        </p>
      </div>

      {/* Demo Mode Notice */}
      {USE_MOCK_MODE && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Demo Mode:</strong> Testnet USDC mismatch prevents real Blend deposit.
            On mainnet, this would be a real transaction. See TESTNET_GAPS.md for details.
          </p>
        </div>
      )}

      {/* Input Amount */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          USDC Amount
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
          Available: {formatBalance(availableBalance)} USDC
        </p>
      </div>

      {/* Yield Info */}
      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-green-600 dark:text-green-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="text-sm text-green-700 dark:text-green-300">
            Your deposit will earn supply APY from borrowers
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Deposit Button */}
      <button
        onClick={handleDeposit}
        disabled={isDepositing || !amount || parseFloat(amount) <= 0}
        className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {isDepositing ? (
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
            Depositing...
          </span>
        ) : USE_MOCK_MODE ? (
          "Simulate Deposit (Demo)"
        ) : (
          "Deposit USDC"
        )}
      </button>
    </div>
  );
}
