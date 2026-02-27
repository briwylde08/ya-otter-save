"use client";

import { useState, useEffect } from "react";
import { OnRampTransaction, Quote } from "@/lib/anchor/types";
import {
  hasTrustline,
  buildChangeTrustTx,
  signWithFreighter,
  submitToHorizon,
} from "@/lib/stellar/transaction";
import { CETES_ISSUER } from "@/lib/stellar/assets";
import { Asset } from "@stellar/stellar-sdk";
import { validateAmount } from "@/lib/validation";
import { debug } from "@/lib/debug";

interface OnRampProps {
  publicKey: string;
  onComplete: (cetesAmount: string) => void;
}

type OnRampStep = "trustline" | "amount" | "quote" | "payment" | "polling" | "complete";

export function OnRamp({ publicKey, onComplete }: OnRampProps) {
  const [step, setStep] = useState<OnRampStep>("trustline");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [transaction, setTransaction] = useState<OnRampTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCetesTrustline, setHasCetesTrustline] = useState<boolean | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);

  // Check for CETES trustline on mount
  useEffect(() => {
    const checkTrustline = async () => {
      try {
        const has = await hasTrustline(publicKey, "CETES", CETES_ISSUER);
        setHasCetesTrustline(has);
        if (has) {
          setStep("amount");
        }
      } catch (err) {
        debug.error("OnRamp", "Error checking trustline:", err);
        // Assume no trustline on error
        setHasCetesTrustline(false);
      }
    };
    checkTrustline();
  }, [publicKey]);

  const handleAddTrustline = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build trustline transaction
      const cetesAsset = new Asset("CETES", CETES_ISSUER);
      const xdr = await buildChangeTrustTx(publicKey, cetesAsset);

      // Sign with Freighter
      const signedXdr = await signWithFreighter(xdr, publicKey);

      // Submit to network
      const result = await submitToHorizon(signedXdr);

      if (result.success) {
        setHasCetesTrustline(true);
        setStep("amount");
      } else {
        throw new Error(result.error || "Failed to add trustline");
      }
    } catch (err) {
      debug.error("OnRamp", "Error adding trustline:", err);
      setError(err instanceof Error ? err.message : "Failed to add trustline");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetQuote = async () => {
    const amountError = validateAmount(amount, {
      min: 1, // Minimum 1 MXN
      max: 100_000, // Maximum 100,000 MXN per transaction
      maxDecimals: 2, // MXN has 2 decimal places
      fieldName: "Amount"
    });
    if (amountError) {
      setError(amountError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/anchor/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAsset: "MXN",
          destinationAsset: "CETES",
          sourceAmount: amount,
          publicKey,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get quote");
      }

      const quoteData = await response.json();
      setQuote(quoteData);
      setStep("quote");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get quote");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOnRamp = async () => {
    if (!quote) return;

    setIsLoading(true);
    setError(null);
    setOnboardingUrl(null);

    try {
      const response = await fetch("/api/anchor/onramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          destinationAddress: publicKey,
          customerId: quote.customerId,
        }),
      });

      const data = await response.json();

      // Check for onboarding required error
      if (data.code === "ONBOARDING_REQUIRED" && data.onboardingUrl) {
        setOnboardingUrl(data.onboardingUrl);
        setError("This wallet needs to complete Etherfuse onboarding before on-ramping.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to create on-ramp transaction");
      }

      setTransaction(data);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transaction");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!transaction) return;

    setIsLoading(true);
    setStep("polling");

    try {
      // Simulate the payment being received (demo mode)
      const response = await fetch("/api/anchor/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transaction.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to simulate payment");
      }

      // Wait a bit for "processing"
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process payment");
      setStep("payment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        On-Ramp CETES
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Convert MXN to CETES (Mexican Government T-Bills)
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
          {onboardingUrl && (
            <div className="mt-3">
              <a
                href={onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
              >
                Complete Etherfuse Onboarding
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                After completing onboarding, return here and try again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 0: Trustline Check */}
      {step === "trustline" && (
        <div className="space-y-4">
          {hasCetesTrustline === null ? (
            <div className="text-center py-4">
              <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Checking wallet setup...
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Trustline Required
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  To receive CETES tokens, your wallet needs to trust the CETES asset.
                  This is a one-time setup that requires a small network fee.
                </p>
              </div>
              <button
                onClick={handleAddTrustline}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {isLoading ? "Adding Trustline..." : "Add CETES Trustline"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 1: Enter Amount */}
      {step === "amount" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount (MXN)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={handleGetQuote}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {isLoading ? "Getting Quote..." : "Get Quote"}
          </button>
        </div>
      )}

      {/* Step 2: Review Quote */}
      {step === "quote" && quote && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">You Pay</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {quote.sourceAmount} MXN
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">You Receive</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                {parseFloat(quote.destinationAmount).toFixed(4)} CETES
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Rate</span>
              <span className="text-gray-600 dark:text-gray-300">
                1 CETES = {(1 / parseFloat(quote.rate)).toFixed(2)} MXN
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Fee</span>
              <span className="text-gray-600 dark:text-gray-300">{quote.fee} MXN</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep("amount")}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={handleCreateOnRamp}
              disabled={isLoading}
              className="flex-1 py-2 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {isLoading ? "Creating..." : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment Instructions */}
      {step === "payment" && transaction?.paymentInstructions && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              SPEI Transfer Instructions
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">CLABE: </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {transaction.paymentInstructions.clabe}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Beneficiary: </span>
                <span className="text-gray-900 dark:text-white">
                  {transaction.paymentInstructions.beneficiary}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Bank: </span>
                <span className="text-gray-900 dark:text-white">
                  {transaction.paymentInstructions.bank}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Amount: </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {transaction.paymentInstructions.amount} MXN
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Reference: </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {transaction.paymentInstructions.reference}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
            <strong>Demo Mode:</strong> Click the button below to simulate the SPEI payment
            being received.
          </div>

          <button
            onClick={handleSimulatePayment}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
          >
            {isLoading ? "Processing..." : "Simulate Payment Received"}
          </button>
        </div>
      )}

      {/* Step 4: Polling */}
      {step === "polling" && (
        <div className="text-center py-8">
          <div className="animate-spin w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Processing your on-ramp transaction...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            CETES will appear in your wallet shortly
          </p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === "complete" && quote && (
        <div className="text-center py-6">
          <div className="text-5xl mb-4">🦦✨</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            CETES Received!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Your CETES tokens have been delivered to your wallet.
          </p>
          <p className="text-lg font-semibold text-cyan-600 dark:text-cyan-400 mb-4">
            +{parseFloat(quote.destinationAmount).toFixed(4)} CETES
          </p>
          <button
            onClick={() => onComplete(quote.destinationAmount)}
            className="py-2 px-6 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
