"use client";

import { useState } from "react";
import { simulateAndSubmitSoroban } from "@/lib/stellar/transaction";
import { blendClient } from "@/lib/blend";
import { unitsToStroops } from "@/lib/stellar/assets";

interface BlendWithdrawProps {
  publicKey: string;
  assetAddress: string;
  assetSymbol: string;
  suppliedAmount: string;
  hasOutstandingDebt: boolean;
  onComplete: () => void;
}

export function BlendWithdraw({
  publicKey,
  assetAddress,
  assetSymbol,
  suppliedAmount,
  hasOutstandingDebt,
  onComplete,
}: BlendWithdrawProps) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > parseFloat(suppliedAmount)) {
      setError("Amount exceeds supplied balance");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amountBigInt = unitsToStroops(amount);

      const opXdr = await blendClient.buildWithdrawCollateralOp(
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
      console.error("[BlendWithdraw] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to withdraw");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(suppliedAmount);
  };

  if (txHash) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center">
        <div className="text-5xl mb-4">🦦💎</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Collateral Withdrawn!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Successfully withdrew {amount} {assetSymbol}
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
        Withdraw Collateral
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Withdraw your supplied {assetSymbol} from the pool
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {hasOutstandingDebt && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          <strong>Warning:</strong> You have outstanding debt. Withdrawing collateral may
          reduce your health factor and risk liquidation.
        </div>
      )}

      <div className="space-y-4">
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Supplied Balance</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {parseFloat(suppliedAmount).toFixed(4)} {assetSymbol}
            </span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Withdraw Amount ({assetSymbol})
            </label>
            <button
              onClick={handleMaxClick}
              className="text-xs text-cyan-600 hover:text-cyan-700"
              disabled={hasOutstandingDebt}
            >
              Max: {parseFloat(suppliedAmount).toFixed(4)}
            </button>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <button
          onClick={handleWithdraw}
          disabled={isLoading || !amount}
          className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
        >
          {isLoading ? "Withdrawing..." : `Withdraw ${assetSymbol}`}
        </button>
      </div>
    </div>
  );
}
