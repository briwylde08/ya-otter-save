// Anchor integration types based on regional-starter-pack patterns

export type KycStatus =
  | "not_started"
  | "pending"
  | "approved"
  | "rejected"
  | "update_required";

export type TransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded";

export interface Customer {
  id: string;
  email: string;
  publicKey?: string;
  kycStatus: KycStatus;
  createdAt: string;
}

export interface Quote {
  id: string;
  sourceAsset: string;
  destinationAsset: string;
  sourceAmount: string;
  destinationAmount: string;
  rate: string;
  fee: string;
  expiresAt: string;
  customerId?: string; // Customer ID for use in onramp/offramp
}

export interface PaymentInstructions {
  type: "spei";
  clabe: string;
  beneficiary: string;
  bank: string;
  amount: string;
  currency: string;
  reference: string;
}

export interface OnRampTransaction {
  id: string;
  customerId: string;
  status: TransactionStatus;
  sourceAmount: string;
  sourceAsset: string;
  destinationAmount: string;
  destinationAsset: string;
  destinationAddress: string;
  paymentInstructions?: PaymentInstructions;
  stellarTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OffRampTransaction {
  id: string;
  customerId: string;
  status: TransactionStatus;
  sourceAmount: string;
  sourceAsset: string;
  destinationAmount: string;
  destinationAsset: string;
  bankAccountId: string;
  signableTransaction?: string; // XDR to sign
  stellarTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiatAccount {
  id: string;
  bankName: string;
  clabe: string;
  holderName: string;
  isDefault: boolean;
}

// Input types
export interface CreateCustomerInput {
  email: string;
  publicKey: string;
  country?: string;
}

export interface GetQuoteInput {
  sourceAsset: string;
  destinationAsset: string;
  sourceAmount?: string;
  destinationAmount?: string;
  publicKey?: string; // Stellar address for customer creation
}

export interface CreateOnRampInput {
  customerId: string;
  quoteId: string;
  destinationAddress: string;
}

export interface CreateOffRampInput {
  customerId: string;
  quoteId: string;
  bankAccountId: string;
  publicKey: string; // Stellar address burning the CETES
}

export interface RegisterFiatAccountInput {
  customerId: string;
  clabe: string;
  holderName: string;
}

// Anchor interface that providers implement
export interface Anchor {
  readonly name: string;

  createCustomer(input: CreateCustomerInput): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  getKycUrl(customerId: string, publicKey?: string): Promise<string>;
  getKycStatus(customerId: string, publicKey?: string): Promise<KycStatus>;

  getQuote(input: GetQuoteInput): Promise<Quote>;

  createOnRamp(input: CreateOnRampInput): Promise<OnRampTransaction>;
  getOnRampTransaction(transactionId: string): Promise<OnRampTransaction | null>;

  createOffRamp(input: CreateOffRampInput): Promise<OffRampTransaction>;
  getOffRampTransaction(
    transactionId: string
  ): Promise<OffRampTransaction | null>;

  registerFiatAccount(input: RegisterFiatAccountInput): Promise<FiatAccount>;
  getFiatAccounts(customerId: string): Promise<FiatAccount[]>;
}

// Error class for anchor operations
export class AnchorError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "AnchorError";
  }
}
