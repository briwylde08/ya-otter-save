"use client";

import { useMemo } from "react";

export type OtterMood =
  | "waiting"
  | "ready"
  | "excited"
  | "floating"
  | "borrowed"
  | "calm"
  | "nervous"
  | "delivered"
  | "repaid"
  | "retrieved";

interface OtterStatusProps {
  mood: OtterMood;
  healthFactor?: number;
  className?: string;
}

const OTTER_MESSAGES: Record<OtterMood, { emoji: string; message: string }> = {
  waiting: {
    emoji: "🦦",
    message: "Otter is waiting for a friend...",
  },
  ready: {
    emoji: "🦦",
    message: "Dive in... to some savings!",
  },
  excited: {
    emoji: "🦦✨",
    message: "Otter found some shells!",
  },
  floating: {
    emoji: "🦦🌊",
    message: "Otter is floating (supplied collateral)",
  },
  borrowed: {
    emoji: "🦦🐚",
    message: "Otter borrowed some shells (debt opened)",
  },
  calm: {
    emoji: "🦦😌",
    message: "Otter is chillin'",
  },
  nervous: {
    emoji: "🦦😰",
    message: "Otter is excited!",
  },
  delivered: {
    emoji: "🦦📦",
    message: "Otter delivered the goods!",
  },
  repaid: {
    emoji: "🦦✅",
    message: "Otter paid it back (debt cleared)",
  },
  retrieved: {
    emoji: "🦦💎",
    message: "Otter retrieved the shells!",
  },
};

export function OtterStatus({ mood, healthFactor, className = "" }: OtterStatusProps) {
  const { emoji, message } = useMemo(() => {
    // Override mood based on health factor if provided
    if (healthFactor !== undefined) {
      if (healthFactor < 1.1) {
        return OTTER_MESSAGES.nervous;
      } else if (healthFactor < 1.5) {
        return {
          emoji: "🦦😐",
          message: "Otter is cautious (watch health factor)",
        };
      }
    }
    return OTTER_MESSAGES[mood];
  }, [mood, healthFactor]);

  return (
    <div
      className={`flex items-center gap-3 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950 dark:to-blue-950 rounded-lg border border-cyan-200 dark:border-cyan-800 ${className}`}
    >
      <span className="text-3xl" role="img" aria-label="otter">
        {emoji}
      </span>
      <p className="text-cyan-800 dark:text-cyan-200 font-medium text-lg">{message}</p>
      {healthFactor !== undefined && healthFactor !== Infinity && (
        <span
          className={`ml-auto text-sm font-mono ${
            healthFactor < 1.1
              ? "text-red-600 dark:text-red-400"
              : healthFactor < 1.5
              ? "text-yellow-600 dark:text-yellow-400"
              : "text-green-600 dark:text-green-400"
          }`}
        >
          HF: {healthFactor.toFixed(2)}
        </span>
      )}
    </div>
  );
}
