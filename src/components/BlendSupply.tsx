"use client";

import { useState } from "react";
import { signWithFreighter, simulateAndSubmitSoroban } from "@/lib/stellar/transaction";
import { blendClient } from "@/lib/blend";
import { unitsToStroops } from "@/lib/stellar/assets";

interface BlendSupplyProps {
  publicKey: string;
  assetAddress: string;
  assetSymbol: string;
  availableBalance: string;
  onComplete: () => void;
}

export function BlendSupply({
  publicKey,
  assetAddress,
  assetSymbol,
  availableBalance,
  onComplete,
}: BlendSupplyProps) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSupply = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > parseFloat(availableBalance)) {
      setError("Insufficient balance");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convert amount to contract format (stroops)
      const amountBigInt = unitsToStroops(amount);

      // Build the supply operation
      const opXdr = await blendClient.buildSupplyCollateralOp(
        publicKey,
        assetAddress,
        amountBigInt
      );

      // Simulate and submit
      const result = await simulateAndSubmitSoroban(opXdr, publicKey);

      if (result.success) {
        setTxHash(result.hash || null);
        onComplete();
      } else {
        setError(result.error || "Transaction failed");
      }
    } catch (err) {
      console.error("[BlendSupply] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to supply collateral");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(availableBalance);
  };

  if (txHash) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center">
        <div className="text-5xl mb-4">🦦🌊</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Collateral Supplied!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Successfully supplied {amount} {assetSymbol} to Blend
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
        Supply to Blend Pool
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Supply {assetSymbol} as collateral to enable borrowing
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
            <button
              onClick={handleMaxClick}
              className="text-xs text-cyan-600 hover:text-cyan-700"
            >
              Max: {parseFloat(availableBalance).toFixed(4)}
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

        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Supply APY</span>
            <span className="text-green-600 dark:text-green-400">~3.5%</span>
          </div>
        </div>

        <button
          onClick={handleSupply}
          disabled={isLoading || !amount}
          className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
        >
          {isLoading ? "Supplying..." : `Supply ${assetSymbol}`}
        </button>
      </div>
    </div>
  );
}
