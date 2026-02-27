"use client";

import { useState } from "react";
import { simulateAndSubmitSoroban } from "@/lib/stellar/transaction";
import { blendClient } from "@/lib/blend";
import { unitsToStroops } from "@/lib/stellar/assets";

interface BlendBorrowProps {
  publicKey: string;
  assetAddress: string;
  assetSymbol: string;
  availableToBorrow: string;
  onComplete: () => void;
}

export function BlendBorrow({
  publicKey,
  assetAddress,
  assetSymbol,
  availableToBorrow,
  onComplete,
}: BlendBorrowProps) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleBorrow = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > parseFloat(availableToBorrow)) {
      setError("Amount exceeds borrow limit");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amountBigInt = unitsToStroops(amount);

      const opXdr = await blendClient.buildBorrowOp(
        publicKey,
        assetAddress,
        amountBigInt
      );

      const result = await simulateAndSubmitSoroban(opXdr, publicKey);

      if (result.success) {
        setTxHash(result.hash || null);
        onComplete();
      } else {
        setError(result.error || "Transaction failed");
      }
    } catch (err) {
      console.error("[BlendBorrow] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to borrow");
    } finally {
      setIsLoading(false);
    }
  };

  if (txHash) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center">
        <div className="text-5xl mb-4">🦦🐚</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Borrowed Successfully!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          You borrowed {amount} {assetSymbol}
        </p>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-600 hover:text-cyan-700 text-sm"
        >
          View on Explorer →
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        Borrow from Blend Pool
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Borrow {assetSymbol} against your collateral
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Amount ({assetSymbol})
            </label>
            <span className="text-xs text-gray-500">
              Available: {parseFloat(availableToBorrow).toFixed(4)}
            </span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Borrow APY</span>
            <span className="text-amber-600 dark:text-amber-400">~5.2%</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Health Factor Impact</span>
            <span className="text-gray-900 dark:text-white">
              {amount ? "Will decrease" : "-"}
            </span>
          </div>
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          <strong>Note:</strong> Borrowed assets must be repaid with interest. Monitor your
          health factor to avoid liquidation.
        </div>

        <button
          onClick={handleBorrow}
          disabled={isLoading || !amount}
          className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
        >
          {isLoading ? "Borrowing..." : `Borrow ${assetSymbol}`}
        </button>
      </div>
    </div>
  );
}
