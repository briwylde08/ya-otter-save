"use client";

import { useState } from "react";
import { Asset, StrKey } from "@stellar/stellar-sdk";
import {
  buildPaymentTx,
  signWithFreighter,
  submitToHorizon,
} from "@/lib/stellar/transaction";
import { USDC, XLM } from "@/lib/stellar/assets";

interface PaymentProps {
  publicKey: string;
  availableBalance: string;
  assetSymbol: string;
  onComplete: () => void;
}

export function Payment({
  publicKey,
  availableBalance,
  assetSymbol,
  onComplete,
}: PaymentProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handlePayment = async () => {
    // Validate recipient
    if (!recipient || !StrKey.isValidEd25519PublicKey(recipient)) {
      setError("Please enter a valid Stellar address");
      return;
    }

    // Validate amount
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
      // Determine asset based on symbol
      let asset: Asset;
      if (assetSymbol === "XLM") {
        asset = XLM;
      } else if (assetSymbol === "USDC") {
        asset = USDC;
      } else {
        throw new Error(`Unsupported asset: ${assetSymbol}`);
      }

      // Build transaction
      const txXdr = await buildPaymentTx(
        publicKey,
        recipient,
        asset,
        amount,
        memo || undefined
      );

      // Sign with Freighter
      const signedXdr = await signWithFreighter(txXdr, publicKey);

      // Submit to network
      const result = await submitToHorizon(signedXdr);

      if (result.success) {
        setTxHash(result.hash || null);
        onComplete();
      } else {
        setError(result.error || "Payment failed");
      }
    } catch (err) {
      console.error("[Payment] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to send payment");
    } finally {
      setIsLoading(false);
    }
  };

  if (txHash) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center">
        <div className="text-5xl mb-4">🦦📦</div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Payment Sent!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Successfully sent {amount} {assetSymbol}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          To: {recipient.slice(0, 8)}...{recipient.slice(-8)}
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
        Send Payment
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Pay someone with your borrowed {assetSymbol}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="G..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Amount ({assetSymbol})
            </label>
            <span className="text-xs text-gray-500">
              Available: {parseFloat(availableBalance).toFixed(4)}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Memo (optional)
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Payment for..."
            maxLength={28}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
          />
          <p className="text-xs text-gray-500 mt-1">{memo.length}/28 characters</p>
        </div>

        <button
          onClick={handlePayment}
          disabled={isLoading || !recipient || !amount}
          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
        >
          {isLoading ? "Sending..." : `Send ${assetSymbol}`}
        </button>
      </div>
    </div>
  );
}
