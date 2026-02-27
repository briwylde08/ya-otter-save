"use client";

import { useState } from "react";
import { formatBalance } from "@/lib/stellar/assets";
import { validateAmount } from "@/lib/validation";
import { debug } from "@/lib/debug";

interface BlendWithdrawYieldProps {
  publicKey: string;
  depositedAmount: string;
  estimatedYield?: string;
  onComplete: (withdrawnAmount: string, remainingDeposit: string, remainingYield: string, txHash?: string) => void;
}

// Note: On testnet, Blend pools use different USDC than DEX USDC.
// This is a known testnet integration gap - see TESTNET_GAPS.md
const USE_MOCK_MODE = true;

export function BlendWithdrawYield({
  publicKey,
  depositedAmount,
  estimatedYield = "0",
  onComplete,
}: BlendWithdrawYieldProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const totalAvailable = parseFloat(depositedAmount) + parseFloat(estimatedYield);
  const totalAvailableStr = totalAvailable.toFixed(7);

  const handleWithdraw = async () => {
    // Validate amount
    const amountError = validateAmount(withdrawAmount, {
      min: 0.0000001,
      max: totalAvailable,
      maxDecimals: 7,
      fieldName: "Withdrawal amount"
    });

    if (amountError) {
      setError(amountError);
      return;
    }

    setIsWithdrawing(true);
    setError(null);

    try {
      const withdrawValue = parseFloat(withdrawAmount);

      if (USE_MOCK_MODE) {
        // Demo mode: simulate withdrawal (testnet USDC mismatch)
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Calculate remaining amounts
        // Yield is withdrawn first, then principal
        const yieldValue = parseFloat(estimatedYield);
        const depositValue = parseFloat(depositedAmount);

        let remainingYield = yieldValue;
        let remainingDeposit = depositValue;
        let amountToWithdraw = withdrawValue;

        // First take from yield
        if (amountToWithdraw <= remainingYield) {
          remainingYield -= amountToWithdraw;
        } else {
          amountToWithdraw -= remainingYield;
          remainingYield = 0;
          // Then take from principal
          remainingDeposit -= amountToWithdraw;
        }

        onComplete(
          withdrawAmount,
          remainingDeposit.toFixed(7),
          remainingYield.toFixed(7),
          undefined
        );
        return;
      }

      // Real mode would go here - disabled due to testnet asset fragmentation
    } catch (err) {
      debug.error("BlendWithdrawYield", "Error:", err);
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleMaxAmount = () => {
    setWithdrawAmount(totalAvailableStr);
    setError(null);
  };

  const isWithdrawAll = withdrawAmount === totalAvailableStr ||
    Math.abs(parseFloat(withdrawAmount || "0") - totalAvailable) < 0.0000001;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Withdraw from Blend
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Withdraw some or all of your USDC from the Blend pool.
      </p>

      {/* Position Summary */}
      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Original Deposit
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatBalance(depositedAmount)} USDC
          </span>
        </div>

        {parseFloat(estimatedYield) > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-green-600 dark:text-green-400">
              Earned Yield
            </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              +{formatBalance(estimatedYield)} USDC
            </span>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Total Available
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatBalance(totalAvailableStr)} USDC
          </span>
        </div>
      </div>

      {/* Withdrawal Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Amount to Withdraw
        </label>
        <div className="relative">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => {
              setWithdrawAmount(e.target.value);
              setError(null);
            }}
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
          Available: {formatBalance(totalAvailableStr)} USDC
        </p>
      </div>

      {/* Demo Mode Notice */}
      {USE_MOCK_MODE && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Demo Mode:</strong> Simulated withdrawal. On mainnet, this would be a real Blend transaction.
          </p>
        </div>
      )}

      {/* Otter Message */}
      <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🦦</span>
          <span className="text-sm text-cyan-700 dark:text-cyan-300">
            {isWithdrawAll
              ? "Withdrawing everything? Thanks for saving with us!"
              : withdrawAmount
              ? "Partial withdrawal - keep earning on the rest!"
              : "How much would you like to withdraw?"}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Withdraw Button */}
      <button
        onClick={handleWithdraw}
        disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
        className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {isWithdrawing ? (
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
            Withdrawing...
          </span>
        ) : USE_MOCK_MODE ? (
          isWithdrawAll ? "Withdraw All (Demo)" : "Withdraw (Demo)"
        ) : (
          isWithdrawAll ? "Withdraw All USDC" : "Withdraw USDC"
        )}
      </button>
    </div>
  );
}
