"use client";

import { formatBalance } from "@/lib/stellar/assets";
import { WalletState, WalletActions } from "@/hooks/useWallet";

interface WalletConnectProps {
  wallet: WalletState & WalletActions;
}

export function WalletConnect({ wallet }: WalletConnectProps) {
  const {
    isConnected,
    isAllowed,
    publicKey,
    balances,
    isLoading,
    error,
    connect,
    disconnect,
  } = wallet;

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        </div>
      </div>
    );
  }

  if (!isConnected || !isAllowed) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Connect Wallet
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Connect your Freighter wallet to get started
        </p>
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
        )}
        <button
          onClick={connect}
          className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
        >
          Connect Freighter
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Wallet Connected
        </h2>
        <button
          onClick={disconnect}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Disconnect
        </button>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
        <p className="font-mono text-sm text-gray-900 dark:text-white">
          {publicKey?.slice(0, 8)}...{publicKey?.slice(-8)}
        </p>
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error}</p>
      )}

      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Balances</p>
        <div className="space-y-2">
          {balances.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              No balances found
            </p>
          ) : (
            balances.map((b) => {
              const assetName = b.asset === "native" ? "XLM" : b.asset.split(":")[0];
              return (
                <div
                  key={b.asset}
                  className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {assetName}
                  </span>
                  <span className="font-mono text-gray-600 dark:text-gray-300">
                    {formatBalance(b.balance)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
