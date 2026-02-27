"use client";

import { useState, useEffect } from "react";
import { Asset } from "@stellar/stellar-sdk";
import { formatBalance } from "@/lib/stellar/assets";
import { signWithFreighter, submitToHorizon, buildPaymentTx } from "@/lib/stellar/transaction";
import { validateAmount } from "@/lib/validation";
import { debug } from "@/lib/debug";

const CETES_ISSUER = process.env.NEXT_PUBLIC_CETES_ISSUER || "GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4";

interface OffRampProps {
  publicKey: string;
  cetesBalance: string;
  onComplete: (amount: string, txHash?: string) => void;
}

interface OffRampQuote {
  id: string;
  customerId: string;
  cetesAmount: string;
  mxnAmount: string;
  rate: string;
  fee: string;
}

interface OffRampOrderResponse {
  offramp?: {
    orderId: string;
    status?: string;
  };
  orderId?: string;
  id?: string;
}

export function OffRamp({ publicKey, cetesBalance, onComplete }: OffRampProps) {
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<OffRampQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch quote when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      // Validate amount before fetching quote
      const amountError = validateAmount(amount, {
        min: 0.0000001,
        max: parseFloat(cetesBalance) || 1_000_000,
        maxDecimals: 7,
        fieldName: "Amount"
      });
      if (amountError) {
        setQuote(null);
        if (amount && amount.trim() !== "") {
          setError(amountError);
        }
        return;
      }
      setError(null);

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/anchor/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceAsset: "CETES",
            destinationAsset: "MXN",
            sourceAmount: amount,
            publicKey,
          }),
        });

        const data = await response.json();

        if (data.id) {
          // Real quote from Etherfuse
          setQuote({
            id: data.id,
            customerId: data.customerId,
            cetesAmount: amount,
            mxnAmount: data.destinationAmount,
            rate: data.rate,
            fee: data.fee || "0",
          });
        } else {
          // Mock quote for demo
          const mockRate = 17.5;
          const mxnAmount = (parseFloat(amount) * mockRate).toFixed(2);
          setQuote({
            id: "mock-quote",
            customerId: "mock-customer",
            cetesAmount: amount,
            mxnAmount: mxnAmount,
            rate: mockRate.toString(),
            fee: "0",
          });
        }
      } catch (err) {
        debug.error("OffRamp", "Error fetching quote:", err);
        // Use mock quote
        const mockRate = 17.5;
        const mxnAmount = (parseFloat(amount) * mockRate).toFixed(2);
        setQuote({
          id: "mock-quote",
          customerId: "mock-customer",
          cetesAmount: amount,
          mxnAmount: mxnAmount,
          rate: mockRate.toString(),
          fee: "0",
        });
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [amount]);

  const handleOffRamp = async () => {
    if (!quote) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Check if using mock quote
      if (quote.id === "mock-quote") {
        // Simulate for demo
        await new Promise((resolve) => setTimeout(resolve, 2000));
        onComplete(quote.cetesAmount, undefined);
        return;
      }

      // 1. Create off-ramp order with Etherfuse
      const orderResponse = await fetch("/api/anchor/offramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          customerId: quote.customerId,
          sourceAddress: publicKey,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to create off-ramp order");
      }

      const orderResponse2 = await orderResponse.json();
      debug.log("OffRamp", "Raw order response:", orderResponse2);

      // Unwrap nested response - try various structures
      const order = orderResponse2.offramp || orderResponse2.order || orderResponse2;
      debug.log("OffRamp", "Unwrapped order:", order);

      // Try various field names for order ID
      const orderId = order.orderId || order.id || order.order_id || orderResponse2.orderId || orderResponse2.id;

      if (!orderId) {
        throw new Error(`No order ID found in response. Keys: ${Object.keys(order).join(", ")}`);
      }

      debug.log("OffRamp", "Order ID:", orderId);

      // 2. Build payment to burn CETES (send to issuer with order ID as memo)
      // Stellar text memos are max 28 bytes, so truncate UUID (Etherfuse also matches by sender pubkey)
      const memoText = orderId.replace(/-/g, "").slice(0, 28);
      debug.log("OffRamp", "Memo (truncated):", memoText);

      const cetesAsset = new Asset("CETES", CETES_ISSUER);
      const txXdr = await buildPaymentTx(
        publicKey,
        CETES_ISSUER, // Sending to issuer burns the tokens
        cetesAsset,
        quote.cetesAmount,
        memoText // Memo so Etherfuse can match the payment
      );

      debug.log("OffRamp", "Built burn transaction, requesting signature...");

      // 3. Sign with Freighter
      const signedXdr = await signWithFreighter(txXdr, publicKey);

      // 4. Submit to Stellar network
      const submitResult = await submitToHorizon(signedXdr);

      if (!submitResult.success) {
        throw new Error(submitResult.error || "Failed to submit burn transaction");
      }

      debug.log("OffRamp", "Burn transaction submitted:", submitResult.hash);

      // 5. Success - MXN will be settled to bank account
      onComplete(quote.cetesAmount, submitResult.hash);
    } catch (err) {
      debug.error("OffRamp", "Error:", err);
      setError(err instanceof Error ? err.message : "Off-ramp failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(cetesBalance);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Off-Ramp to MXN
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Convert your CETES back to Mexican Pesos via Etherfuse. The MXN will be
        deposited to your registered bank account.
      </p>

      {/* Input Amount */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          CETES Amount
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
          Available: {formatBalance(cetesBalance)} CETES
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
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              You will receive
            </span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              ${formatBalance(quote.mxnAmount)} MXN
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Exchange Rate
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              1 CETES = {quote.rate} MXN
            </span>
          </div>
        </div>
      )}

      {/* Bank Account Note */}
      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
        <div className="flex items-start space-x-2">
          <span className="text-amber-600 dark:text-amber-400 mt-0.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            MXN will be deposited to your registered SPEI bank account. Settlement
            typically takes 1-2 business days.
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Off-Ramp Button */}
      <button
        onClick={handleOffRamp}
        disabled={!quote || isProcessing || isLoading}
        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {isProcessing ? (
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
            Processing Off-Ramp...
          </span>
        ) : (
          "Off-Ramp to MXN"
        )}
      </button>
    </div>
  );
}
