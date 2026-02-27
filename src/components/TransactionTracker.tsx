"use client";

import { useState } from "react";

export interface TrackedTransaction {
  id: string;
  type: "onramp" | "swap" | "deposit" | "withdraw" | "offramp";
  description: string;
  hash?: string;
  status: "pending" | "success" | "failed";
  timestamp: Date;
  details?: string;
}

interface TransactionTrackerProps {
  transactions: TrackedTransaction[];
  onClear?: () => void;
}

const typeLabels: Record<TrackedTransaction["type"], string> = {
  onramp: "On-Ramp",
  swap: "DEX Swap",
  deposit: "Blend Deposit",
  withdraw: "Blend Withdraw",
  offramp: "Off-Ramp",
};

const typeColors: Record<TrackedTransaction["type"], string> = {
  onramp: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  swap: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  deposit: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  withdraw: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  offramp: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
};

const statusIcons: Record<TrackedTransaction["status"], string> = {
  pending: "⏳",
  success: "✅",
  failed: "❌",
};

export function TransactionTracker({ transactions, onClear }: TransactionTrackerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (transactions.length === 0) {
    return null;
  }

  const stellarExpertUrl = (hash: string) =>
    `https://stellar.expert/explorer/testnet/tx/${hash}`;

  return (
    <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">📜</span>
          <span className="font-medium text-gray-900 dark:text-white">
            Transaction History
          </span>
          <span className="px-2 py-0.5 text-xs bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded-full">
            {transactions.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Transaction List */}
      {isExpanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {transactions
            .slice()
            .reverse()
            .map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-lg">{statusIcons[tx.status]}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            typeColors[tx.type]
                          }`}
                        >
                          {typeLabels[tx.type]}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {tx.description}
                        </span>
                      </div>
                      {tx.details && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {tx.details}
                        </p>
                      )}
                      {tx.hash && (
                        <a
                          href={stellarExpertUrl(tx.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center space-x-1 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-200"
                        >
                          <span className="font-mono">
                            {tx.hash.slice(0, 8)}...{tx.hash.slice(-8)}
                          </span>
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {tx.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Footer with Stellar Expert Link and Clear Button */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          View on{" "}
          <a
            href="https://stellar.expert/explorer/testnet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            Stellar Expert
          </a>
        </p>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Clear History
          </button>
        )}
      </div>
    </div>
  );
}
