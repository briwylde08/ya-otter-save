"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { OtterStatus, OtterMood } from "@/components/OtterStatus";
import { WalletConnect } from "@/components/WalletConnect";
import { OnRamp } from "@/components/OnRamp";
import { Swap } from "@/components/Swap";
import { BlendDeposit } from "@/components/BlendDeposit";
import { BlendWithdrawYield } from "@/components/BlendWithdrawYield";
import { OffRamp } from "@/components/OffRamp";
import { SwimmingOtter } from "@/components/SwimmingOtter";
import {
  TransactionTracker,
  TrackedTransaction,
} from "@/components/TransactionTracker";
import { formatBalance, CETES_ISSUER, USDC_ISSUER } from "@/lib/stellar/assets";
import {
  demoStateSchema,
  transactionsArraySchema,
  safeParseLocalStorage,
} from "@/lib/validation";

// Helper to extract balance from wallet balances array
function getAssetBalance(
  balances: Array<{ asset: string; balance: string }>,
  assetCode: string,
  issuer: string
): string {
  const assetKey = `${assetCode}:${issuer}`;
  const found = balances.find((b) => b.asset === assetKey);
  return found?.balance || "0";
}

type AppView =
  | "connect"
  | "dashboard"
  | "onramp"
  | "swap-to-usdc"
  | "deposit"
  | "earning"
  | "withdraw"
  | "swap-to-cetes"
  | "offramp";

export default function Home() {
  const wallet = useWallet();
  const [currentView, setCurrentView] = useState<AppView>("connect");
  const [demoState, setDemoState] = useState({
    cetesBalance: "0",
    usdcBalance: "0",
    depositedAmount: "0",
    estimatedYield: "0",
  });
  const [transactions, setTransactions] = useState<TrackedTransaction[]>([]);
  const [stateLoaded, setStateLoaded] = useState(false);

  // Load state from localStorage on mount with validation
  useEffect(() => {
    const defaultDemoState = {
      cetesBalance: "0",
      usdcBalance: "0",
      depositedAmount: "0",
      estimatedYield: "0",
    };

    // Load and validate demo state
    const validatedDemoState = safeParseLocalStorage(
      "ya-otter-demo-state",
      demoStateSchema,
      defaultDemoState
    );
    setDemoState(validatedDemoState);

    // Load and validate transactions
    const validatedTransactions = safeParseLocalStorage(
      "ya-otter-transactions",
      transactionsArraySchema,
      []
    );
    // Restore Date objects
    const restored = validatedTransactions.map((tx) => ({
      ...tx,
      timestamp: new Date(tx.timestamp),
    }));
    setTransactions(restored as TrackedTransaction[]);

    setStateLoaded(true);
  }, []);

  // Save transactions to localStorage when they change
  useEffect(() => {
    if (stateLoaded) {
      localStorage.setItem("ya-otter-transactions", JSON.stringify(transactions));
    }
  }, [transactions, stateLoaded]);

  // Save demo state to localStorage when it changes
  useEffect(() => {
    if (stateLoaded) {
      localStorage.setItem("ya-otter-demo-state", JSON.stringify(demoState));
    }
  }, [demoState, stateLoaded]);

  // Clear transaction history
  const clearTransactions = () => {
    setTransactions([]);
    localStorage.removeItem("ya-otter-transactions");
  };

  // Helper to add a transaction
  const addTransaction = (
    type: TrackedTransaction["type"],
    description: string,
    hash?: string,
    details?: string
  ) => {
    const tx: TrackedTransaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      description,
      hash,
      status: hash ? "success" : "pending",
      timestamp: new Date(),
      details,
    };
    setTransactions((prev) => [...prev, tx]);
    return tx.id;
  };

  // Update view based on wallet connection
  useEffect(() => {
    if (wallet.publicKey && currentView === "connect") {
      setCurrentView("dashboard");
    } else if (!wallet.publicKey && currentView !== "connect") {
      setCurrentView("connect");
    }
  }, [wallet.publicKey, currentView]);

  // Simulate yield accrual when in earning state
  useEffect(() => {
    if (currentView !== "earning") return;

    const interval = setInterval(() => {
      setDemoState((prev) => {
        const currentYield = parseFloat(prev.estimatedYield);
        const deposit = parseFloat(prev.depositedAmount);
        const yieldIncrement = deposit * 0.00001;
        return {
          ...prev,
          estimatedYield: (currentYield + yieldIncrement).toFixed(7),
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [currentView]);

  // Determine otter mood based on state
  const getOtterMood = (): OtterMood => {
    if (!wallet.isConnected) return "waiting";
    if (currentView === "dashboard") return "calm";
    if (currentView === "onramp") return "ready";
    if (currentView === "earning") return "floating";
    if (currentView === "offramp") return "delivered";
    return "excited";
  };

  // Get real balances from Stellar (wallet.balances is fetched from Horizon)
  const realCetesBalance = getAssetBalance(wallet.balances, "CETES", CETES_ISSUER);
  const realUsdcBalance = getAssetBalance(wallet.balances, "USDC", USDC_ISSUER);

  // Check if user has any balances
  const hasCetes = parseFloat(realCetesBalance) > 0;
  const hasUsdc = parseFloat(realUsdcBalance) > 0;
  const hasBlendPosition = parseFloat(demoState.depositedAmount) > 0;
  const hasAnyBalance = hasCetes || hasUsdc || hasBlendPosition;

  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <SwimmingOtter />

      <div className="max-w-2xl mx-auto px-4 py-8 relative z-20">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-5xl font-title text-cyan-600 dark:text-cyan-400 mb-2 drop-shadow-sm">
            Ya Otter Save
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            On-ramp MXN to CETES, swap to USDC, earn yield on Blend
          </p>
          {wallet.publicKey && (
            <div className="mt-3 inline-flex items-center px-3 py-1.5 bg-cyan-100 dark:bg-cyan-900/50 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              <span className="text-xs font-mono text-cyan-700 dark:text-cyan-300">
                {wallet.publicKey.slice(0, 4)}...{wallet.publicKey.slice(-4)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(wallet.publicKey!)}
                className="ml-2 text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-200"
                title="Copy address"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={wallet.disconnect}
                className="ml-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                title="Disconnect wallet"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </header>

        {/* Otter Status */}
        <OtterStatus mood={getOtterMood()} className="mb-6" />

        {/* Main Content */}
        <div className="space-y-6">
          {/* Connect Wallet */}
          {currentView === "connect" && <WalletConnect wallet={wallet} />}

          {/* Dashboard */}
          {currentView === "dashboard" && wallet.publicKey && (
            <div className="space-y-6">
              {/* Balances Card */}
              <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Your Balances
                </h2>

                <div className="space-y-3">
                  {/* CETES Balance */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🇲🇽</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">CETES</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Mexican T-Bills</p>
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatBalance(realCetesBalance)}
                    </span>
                  </div>

                  {/* USDC Balance */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">💵</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">USDC</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">USD Coin</p>
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatBalance(realUsdcBalance)}
                    </span>
                  </div>

                  {/* Blend Position */}
                  {hasBlendPosition && (
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-green-50 dark:from-cyan-900/30 dark:to-green-900/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🏦</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Blend Position</p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            +{formatBalance(demoState.estimatedYield)} yield earned
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatBalance(demoState.depositedAmount)} USDC
                      </span>
                    </div>
                  )}

                  {!hasAnyBalance && (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      <p>No balances yet. On-ramp some MXN to get started!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Card */}
              <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Actions
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  {/* On-Ramp */}
                  <button
                    onClick={() => setCurrentView("onramp")}
                    className="p-4 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg border border-green-200 dark:border-green-800 transition-colors text-left"
                  >
                    <span className="text-2xl mb-2 block">🇲🇽</span>
                    <p className="font-medium text-gray-900 dark:text-white">On-Ramp</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">MXN → CETES</p>
                  </button>

                  {/* Swap to USDC */}
                  <button
                    onClick={() => setCurrentView("swap-to-usdc")}
                    disabled={!hasCetes}
                    className="p-4 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-blue-200 dark:border-blue-800 transition-colors text-left"
                  >
                    <span className="text-2xl mb-2 block">🔄</span>
                    <p className="font-medium text-gray-900 dark:text-white">Swap</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">CETES → USDC</p>
                  </button>

                  {/* Earn Yield */}
                  <button
                    onClick={() => hasBlendPosition ? setCurrentView("earning") : setCurrentView("deposit")}
                    disabled={!hasUsdc && !hasBlendPosition}
                    className="p-4 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-purple-200 dark:border-purple-800 transition-colors text-left"
                  >
                    <span className="text-2xl mb-2 block">📈</span>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {hasBlendPosition ? "View Position" : "Earn Yield"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {hasBlendPosition ? "Blend lending pool" : "Deposit to Blend"}
                    </p>
                  </button>

                  {/* Off-Ramp */}
                  <button
                    onClick={() => hasCetes ? setCurrentView("offramp") : setCurrentView("swap-to-cetes")}
                    disabled={!hasCetes && !hasUsdc}
                    className="p-4 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg border border-amber-200 dark:border-amber-800 transition-colors text-left"
                  >
                    <span className="text-2xl mb-2 block">💰</span>
                    <p className="font-medium text-gray-900 dark:text-white">Off-Ramp</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {hasCetes ? "CETES → MXN" : "USDC → CETES → MXN"}
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* On-Ramp */}
          {currentView === "onramp" && wallet.publicKey && (
            <>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <OnRamp
                publicKey={wallet.publicKey}
                onComplete={(cetesAmount) => {
                  addTransaction(
                    "onramp",
                    `MXN → ${cetesAmount} CETES`,
                    undefined,
                    "On-ramped via Etherfuse"
                  );
                  // Refresh to get actual on-chain balance
                  wallet.refreshBalances();
                  setCurrentView("dashboard");
                }}
              />
            </>
          )}

          {/* Swap CETES to USDC */}
          {currentView === "swap-to-usdc" && wallet.publicKey && (
            <>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <Swap
                publicKey={wallet.publicKey}
                direction="cetes-to-usdc"
                availableBalance={realCetesBalance}
                onComplete={(usdcAmount, txHash) => {
                  addTransaction(
                    "swap",
                    `CETES → ${usdcAmount} USDC`,
                    txHash,
                    "Swapped via Stellar DEX"
                  );
                  wallet.refreshBalances();
                  setCurrentView("dashboard");
                }}
              />
            </>
          )}

          {/* Deposit to Blend */}
          {currentView === "deposit" && wallet.publicKey && (
            <>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <BlendDeposit
                publicKey={wallet.publicKey}
                availableBalance={realUsdcBalance}
                onComplete={(newDepositAmount, txHash) => {
                  addTransaction(
                    "deposit",
                    `${newDepositAmount} USDC → Blend`,
                    txHash,
                    "Deposited to Blend lending pool"
                  );
                  setDemoState((prev) => {
                    const existingDeposit = parseFloat(prev.depositedAmount) || 0;
                    const newTotal = existingDeposit + parseFloat(newDepositAmount);
                    return {
                      ...prev,
                      usdcBalance: "0",
                      depositedAmount: newTotal.toFixed(7),
                      // Keep existing yield when adding more
                    };
                  });
                  setCurrentView("earning");
                }}
              />
            </>
          )}

          {/* Earning Yield */}
          {currentView === "earning" && wallet.publicKey && (
            <>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Earning Yield
                </h2>

                <div className="mb-6 p-4 bg-gradient-to-r from-cyan-50 to-green-50 dark:from-cyan-900/30 dark:to-green-900/30 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Deposited</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      {parseFloat(demoState.depositedAmount).toFixed(4)} USDC
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-green-600 dark:text-green-400">Yield Earned</span>
                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                      +{parseFloat(demoState.estimatedYield).toFixed(7)} USDC
                    </span>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Value</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {(parseFloat(demoState.depositedAmount) + parseFloat(demoState.estimatedYield)).toFixed(4)} USDC
                    </span>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-900/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🦦</span>
                    <span className="text-sm text-cyan-700 dark:text-cyan-300">
                      Your USDC is earning yield in Blend! Withdraw whenever you're ready.
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setCurrentView("deposit")}
                    disabled={!hasUsdc}
                    className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    Deposit More
                  </button>
                  <button
                    onClick={() => setCurrentView("withdraw")}
                    className="flex-1 py-3 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Withdraw from Blend */}
          {currentView === "withdraw" && wallet.publicKey && (
            <>
              <button
                onClick={() => setCurrentView("earning")}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <BlendWithdrawYield
                publicKey={wallet.publicKey}
                depositedAmount={demoState.depositedAmount}
                estimatedYield={demoState.estimatedYield}
                onComplete={(withdrawnAmount, remainingDeposit, remainingYield, txHash) => {
                  const isFullWithdraw = parseFloat(remainingDeposit) <= 0;
                  addTransaction(
                    "withdraw",
                    `${withdrawnAmount} USDC from Blend`,
                    txHash,
                    isFullWithdraw ? "Withdrew all funds" : "Partial withdrawal"
                  );
                  setDemoState((prev) => ({
                    ...prev,
                    depositedAmount: remainingDeposit,
                    estimatedYield: remainingYield,
                  }));
                  // Go back to earning view if there's still a position, otherwise dashboard
                  if (parseFloat(remainingDeposit) > 0) {
                    setCurrentView("earning");
                  } else {
                    setCurrentView("dashboard");
                  }
                }}
              />
            </>
          )}

          {/* Swap USDC to CETES */}
          {currentView === "swap-to-cetes" && wallet.publicKey && (
            <>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <Swap
                publicKey={wallet.publicKey}
                direction="usdc-to-cetes"
                availableBalance={realUsdcBalance}
                onComplete={(cetesAmount, txHash) => {
                  addTransaction(
                    "swap",
                    `USDC → ${cetesAmount} CETES`,
                    txHash,
                    "Swapped via Stellar DEX"
                  );
                  wallet.refreshBalances();
                  setCurrentView("dashboard");
                }}
              />
            </>
          )}

          {/* Off-Ramp */}
          {currentView === "offramp" && wallet.publicKey && (
            <>
              <button
                onClick={() => setCurrentView("dashboard")}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
              <OffRamp
                publicKey={wallet.publicKey}
                cetesBalance={realCetesBalance}
                onComplete={(amount, txHash) => {
                  addTransaction(
                    "offramp",
                    `${amount} CETES → MXN`,
                    txHash,
                    txHash ? "Off-ramped via Etherfuse" : "Off-ramped via Etherfuse (pending settlement)"
                  );
                  wallet.refreshBalances();
                  setCurrentView("dashboard");
                }}
              />
            </>
          )}

          {/* Transaction Tracker */}
          <TransactionTracker transactions={transactions} onClear={clearTransactions} />
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built on Stellar Testnet with Blend Protocol</p>
          <p className="mt-1">
            <a
              href="https://github.com/briwylde08/ya-otter-save"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-600 hover:text-cyan-700"
            >
              View Source
            </a>
            {" • "}
            <a
              href="https://docs.blend.capital"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-600 hover:text-cyan-700"
            >
              Blend Docs
            </a>
            {" • "}
            <a
              href="https://www.etherfuse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-600 hover:text-cyan-700"
            >
              Etherfuse
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
