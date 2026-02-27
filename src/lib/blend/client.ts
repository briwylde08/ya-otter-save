/**
 * Blend Protocol Client
 *
 * Wrapper around @blend-capital/blend-sdk for pool interactions.
 * Used for the "Ya Otter Save" flow to supply USDC and earn yield.
 */

import {
  PoolV2,
  PoolContractV2,
  RequestType,
  Request,
} from "@blend-capital/blend-sdk";
import { getNetwork, getSorobanClient } from "../stellar/config";
import { HealthStatus, PositionSummary, Reserve } from "./types";

// Blend testnet pool ID (TestNet V2 from blend-utils)
const BLEND_POOL_ID =
  process.env.NEXT_PUBLIC_BLEND_POOL_ID ||
  "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF";

// USDC contract address on testnet (for Blend interactions)
const USDC_CONTRACT =
  process.env.NEXT_PUBLIC_USDC_CONTRACT ||
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

export class BlendClient {
  private poolId: string;
  private network: ReturnType<typeof getNetwork>;

  constructor(poolId?: string) {
    this.poolId = poolId || BLEND_POOL_ID;
    this.network = getNetwork();

    if (!this.poolId) {
      console.warn("[BlendClient] No pool ID configured. Set NEXT_PUBLIC_BLEND_POOL_ID");
    }
  }

  /**
   * Load pool configuration and reserves
   */
  async loadPool(): Promise<PoolV2 | null> {
    if (!this.poolId) return null;

    try {
      const pool = await PoolV2.load(this.network, this.poolId);
      return pool;
    } catch (error) {
      console.error("[BlendClient] Failed to load pool:", error);
      return null;
    }
  }

  /**
   * Get health status for a user (simplified for demo)
   */
  async getHealthStatus(userAddress: string): Promise<HealthStatus | null> {
    // For demo, return a mock healthy status
    // In production, load actual user positions and calculate
    return {
      healthFactor: 1.5,
      totalCollateralValue: 0,
      totalBorrowValue: 0,
      borrowLimit: 0,
      availableToBorrow: 0,
      isHealthy: true,
    };
  }

  /**
   * Build supply operation XDR (earn yield without using as collateral)
   * This is the primary operation for "Ya Otter Save" flow
   */
  async buildSupplyOp(
    userAddress: string,
    assetAddress: string,
    amount: bigint
  ): Promise<string> {
    if (!this.poolId) {
      throw new Error("Pool ID not configured");
    }

    const contract = new PoolContractV2(this.poolId);

    const requests: Request[] = [
      {
        request_type: RequestType.Supply,
        address: assetAddress,
        amount: amount,
      },
    ];

    const op = contract.submit({
      from: userAddress,
      spender: userAddress,
      to: userAddress,
      requests: requests,
    });

    return op;
  }

  /**
   * Build supply collateral operation XDR (for borrowing flow)
   */
  async buildSupplyCollateralOp(
    userAddress: string,
    assetAddress: string,
    amount: bigint
  ): Promise<string> {
    if (!this.poolId) {
      throw new Error("Pool ID not configured");
    }

    const contract = new PoolContractV2(this.poolId);

    const requests: Request[] = [
      {
        request_type: RequestType.SupplyCollateral,
        address: assetAddress,
        amount: amount,
      },
    ];

    const op = contract.submit({
      from: userAddress,
      spender: userAddress,
      to: userAddress,
      requests: requests,
    });

    return op;
  }

  /**
   * Build borrow operation XDR
   */
  async buildBorrowOp(
    userAddress: string,
    assetAddress: string,
    amount: bigint
  ): Promise<string> {
    if (!this.poolId) {
      throw new Error("Pool ID not configured");
    }

    const contract = new PoolContractV2(this.poolId);

    const requests: Request[] = [
      {
        request_type: RequestType.Borrow,
        address: assetAddress,
        amount: amount,
      },
    ];

    const op = contract.submit({
      from: userAddress,
      spender: userAddress,
      to: userAddress,
      requests: requests,
    });

    return op;
  }

  /**
   * Build repay operation XDR
   */
  async buildRepayOp(
    userAddress: string,
    assetAddress: string,
    amount: bigint
  ): Promise<string> {
    if (!this.poolId) {
      throw new Error("Pool ID not configured");
    }

    const contract = new PoolContractV2(this.poolId);

    const requests: Request[] = [
      {
        request_type: RequestType.Repay,
        address: assetAddress,
        amount: amount,
      },
    ];

    const op = contract.submit({
      from: userAddress,
      spender: userAddress,
      to: userAddress,
      requests: requests,
    });

    return op;
  }

  /**
   * Build withdraw operation XDR (withdraw supplied assets + yield)
   * This is the primary operation for "Ya Otter Save" flow
   */
  async buildWithdrawOp(
    userAddress: string,
    assetAddress: string,
    amount: bigint
  ): Promise<string> {
    if (!this.poolId) {
      throw new Error("Pool ID not configured");
    }

    const contract = new PoolContractV2(this.poolId);

    const requests: Request[] = [
      {
        request_type: RequestType.Withdraw,
        address: assetAddress,
        amount: amount,
      },
    ];

    const op = contract.submit({
      from: userAddress,
      spender: userAddress,
      to: userAddress,
      requests: requests,
    });

    return op;
  }

  /**
   * Build withdraw collateral operation XDR (for borrowing flow)
   */
  async buildWithdrawCollateralOp(
    userAddress: string,
    assetAddress: string,
    amount: bigint
  ): Promise<string> {
    if (!this.poolId) {
      throw new Error("Pool ID not configured");
    }

    const contract = new PoolContractV2(this.poolId);

    const requests: Request[] = [
      {
        request_type: RequestType.WithdrawCollateral,
        address: assetAddress,
        amount: amount,
      },
    ];

    const op = contract.submit({
      from: userAddress,
      spender: userAddress,
      to: userAddress,
      requests: requests,
    });

    return op;
  }

  /**
   * Get position summary for UI display (simplified for demo)
   */
  async getPositionSummary(userAddress: string): Promise<PositionSummary[]> {
    // For demo, return empty - in production load from pool.loadUser()
    return [];
  }

  /**
   * Get available reserves in the pool (simplified for demo)
   */
  async getReserves(): Promise<Reserve[]> {
    // For demo, return empty - in production load from pool.reserves
    return [];
  }

  /**
   * Helper: Build USDC supply operation
   */
  async buildUsdcSupplyOp(
    userAddress: string,
    amount: bigint
  ): Promise<string> {
    return this.buildSupplyOp(userAddress, USDC_CONTRACT, amount);
  }

  /**
   * Helper: Build USDC withdraw operation
   */
  async buildUsdcWithdrawOp(
    userAddress: string,
    amount: bigint
  ): Promise<string> {
    return this.buildWithdrawOp(userAddress, USDC_CONTRACT, amount);
  }

  /**
   * Get pool ID for reference
   */
  getPoolId(): string {
    return this.poolId;
  }

  /**
   * Get USDC contract address
   */
  getUsdcContract(): string {
    return USDC_CONTRACT;
  }
}

// Export singleton instance
export const blendClient = new BlendClient();
