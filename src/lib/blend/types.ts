/**
 * Blend Protocol Types
 *
 * Based on @blend-capital/blend-sdk
 */

// Request types for pool operations
export enum RequestType {
  Supply = 0,
  Withdraw = 1,
  SupplyCollateral = 2,
  WithdrawCollateral = 3,
  Borrow = 4,
  Repay = 5,
  FillUserLiquidationAuction = 6,
  FillBadDebtAuction = 7,
  FillInterestAuction = 8,
  DeleteLiquidationAuction = 9,
}

// A request to submit to the pool
export interface Request {
  request_type: RequestType;
  address: string; // Asset contract address
  amount: bigint;
}

// Reserve data from pool
export interface Reserve {
  index: number;
  assetId: string;
  borrowApr: number;
  supplyApr: number;
  collateralFactor: number;
  liabilityFactor: number;
  totalSupply: bigint;
  totalBorrow: bigint;
  dRate: bigint; // Debt token exchange rate
  bRate: bigint; // bToken exchange rate
  lastTime: number;
}

// User position in pool
export interface Position {
  collateral: Map<number, bigint>; // reserve index -> bToken amount
  liabilities: Map<number, bigint>; // reserve index -> dToken amount
  supply: Map<number, bigint>; // reserve index -> supply amount (non-collateral)
}

// Pool configuration
export interface PoolConfig {
  name: string;
  admin: string;
  oracle: string;
  backstop: string;
  maxPositions: number;
  reserves: Reserve[];
}

// Health factor calculation result
export interface HealthStatus {
  healthFactor: number;
  totalCollateralValue: number;
  totalBorrowValue: number;
  borrowLimit: number;
  availableToBorrow: number;
  isHealthy: boolean;
}

// Position summary for UI
export interface PositionSummary {
  asset: string;
  assetSymbol: string;
  supplied: string;
  suppliedValue: string;
  borrowed: string;
  borrowedValue: string;
  supplyApr: string;
  borrowApr: string;
}
