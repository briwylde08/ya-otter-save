/**
 * Etherfuse Anchor Client
 *
 * This client implements the Anchor interface for Etherfuse's CETES on/off-ramp.
 * Based on the regional-starter-pack pattern.
 *
 * Note: This is designed to run server-side only (API routes) to protect the API key.
 */

import {
  Anchor,
  AnchorError,
  Customer,
  Quote,
  OnRampTransaction,
  OffRampTransaction,
  FiatAccount,
  KycStatus,
  CreateCustomerInput,
  GetQuoteInput,
  CreateOnRampInput,
  CreateOffRampInput,
  RegisterFiatAccountInput,
} from "./types";
import { debug } from "../debug";

export class EtherfuseClient implements Anchor {
  readonly name = "etherfuse";
  private baseUrl: string;
  private apiKey: string;
  private persistentCustomerId?: string;
  private persistentBankAccountId?: string;

  constructor(
    apiKey: string,
    baseUrl: string = "https://api.sand.etherfuse.com",
    persistentCustomerId?: string,
    persistentBankAccountId?: string
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.persistentCustomerId = persistentCustomerId;
    this.persistentBankAccountId = persistentBankAccountId;
  }

  private static readonly REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    debug.log("Etherfuse", `${method} ${url}`);
    if (body) {
      debug.log("Etherfuse", "Request body:", body);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      EtherfuseClient.REQUEST_TIMEOUT_MS
    );

    try {
      // NOTE: Etherfuse uses plain API key auth, NOT Bearer token
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null as T;
      }

      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorText = await response.text();
        debug.log("Etherfuse", "Error response (raw):", errorText);
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorText;
        } catch {
          // Not JSON, use raw text
          if (errorText) {
            errorMessage = errorText;
          }
        }
      } catch {
        // Ignore text read errors
      }

      throw new AnchorError(errorMessage, "REQUEST_FAILED", response.status);
    }

    // Handle empty responses (some endpoints return 200/204 with no body)
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0" || response.status === 204) {
      return {} as T;
    }

    // Try to parse JSON, return empty object if no content
    const text = await response.text();
    if (!text || text.trim() === "") {
      return {} as T;
    }

    return JSON.parse(text);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new AnchorError(
          `Request timed out after ${EtherfuseClient.REQUEST_TIMEOUT_MS / 1000}s`,
          "TIMEOUT",
          408
        );
      }
      throw error;
    }
  }

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const response = await this.request<{
      customerId: string;
      onboardingUrl: string;
    }>("POST", "/ramp/onboarding-url", {
      email: input.email,
      publicKey: input.publicKey,
      country: input.country || "MX",
    });

    return {
      id: response.customerId,
      email: input.email,
      publicKey: input.publicKey,
      kycStatus: "not_started",
      createdAt: new Date().toISOString(),
    };
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    const response = await this.request<{
      id: string;
      email: string;
      publicKey?: string;
      kycStatus: string;
      createdAt: string;
    }>("GET", `/ramp/customer/${customerId}`);

    if (!response) return null;

    return {
      id: response.id,
      email: response.email,
      publicKey: response.publicKey,
      kycStatus: response.kycStatus as KycStatus,
      createdAt: response.createdAt,
    };
  }

  async getKycUrl(customerId: string, publicKey?: string): Promise<string> {
    const response = await this.request<{ onboardingUrl: string }>(
      "POST",
      "/ramp/onboarding-url",
      {
        customerId,
        publicKey,
      }
    );

    return response.onboardingUrl;
  }

  async getKycStatus(customerId: string, publicKey?: string): Promise<KycStatus> {
    const endpoint = publicKey
      ? `/ramp/customer/${customerId}/kyc/${publicKey}`
      : `/ramp/customer/${customerId}`;

    const response = await this.request<{ kycStatus: string }>("GET", endpoint);

    return (response?.kycStatus as KycStatus) || "not_started";
  }

  async getQuote(input: GetQuoteInput): Promise<Quote> {
    // Etherfuse requires CETES asset to include issuer: "CETES:<issuer>"
    const CETES_ISSUER = process.env.NEXT_PUBLIC_CETES_ISSUER || "GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4";

    const isOnRamp = input.sourceAsset === "MXN";
    const targetAsset = isOnRamp
      ? `CETES:${CETES_ISSUER}`
      : "MXN";
    const sourceAsset = isOnRamp
      ? "MXN"
      : `CETES:${CETES_ISSUER}`;

    // Generate our own quoteId (Etherfuse expects UUID)
    const quoteId = crypto.randomUUID();

    // Use persistent customerId if available, otherwise create new
    let customerId = this.persistentCustomerId || crypto.randomUUID();

    if (this.persistentCustomerId) {
      debug.log("Etherfuse", "Using persistent customer:", customerId);
    } else if (input.publicKey) {
      // Create a customer - Etherfuse requires a registered customerId
      const bankAccountId = crypto.randomUUID();
      debug.log("Etherfuse", "Creating customer for quote...");
      try {
        await this.request<{ presigned_url: string }>("POST", "/ramp/onboarding-url", {
          customerId,
          bankAccountId,
          email: `user-${customerId.substring(0, 8)}@demo.local`,
          publicKey: input.publicKey,
          blockchain: "stellar",
        });
        debug.log("Etherfuse", "Customer created:", customerId);
      } catch (error) {
        // If 409 conflict, extract existing customerId from error message
        if (error instanceof AnchorError && error.statusCode === 409) {
          const match = error.message.match(/see org: ([a-f0-9-]+)/i);
          if (match) {
            customerId = match[1];
            debug.log("Etherfuse", "Using existing customer:", customerId);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    const response = await this.request<{
      quoteId: string;
      quoteAssets: {
        type: string;
        sourceAsset: string;
        targetAsset: string;
      };
      sourceAmount: string;
      destinationAmount: string;
      destinationAmountAfterFee?: string;
      exchangeRate: string;
      feeAmount?: string;
      expiresAt: string;
      createdAt: string;
    }>("POST", "/ramp/quote", {
      quoteId,
      customerId,
      blockchain: "stellar",
      quoteAssets: {
        type: isOnRamp ? "onramp" : "offramp",
        sourceAsset,
        targetAsset,
      },
      sourceAmount: input.sourceAmount,
    });

    return {
      id: response.quoteId,
      sourceAsset: response.quoteAssets.sourceAsset,
      destinationAsset: response.quoteAssets.targetAsset,
      sourceAmount: response.sourceAmount,
      destinationAmount: response.destinationAmountAfterFee || response.destinationAmount,
      rate: response.exchangeRate,
      fee: response.feeAmount || "0",
      expiresAt: response.expiresAt,
      customerId, // Include customerId for use in onramp
    };
  }

  async createOnRamp(input: CreateOnRampInput): Promise<OnRampTransaction> {
    // Generate orderId (Etherfuse expects UUID)
    const orderId = crypto.randomUUID();

    // Use persistent bank account ID if available (MUST match onboarding)
    let bankAccountId: string;
    if (this.persistentBankAccountId) {
      bankAccountId = this.persistentBankAccountId;
      debug.log("Etherfuse", "Using persistent bank account:", bankAccountId);
    } else {
      // Try to get the customer's registered bank account
      try {
        const accounts = await this.getFiatAccounts(input.customerId);
        if (accounts.length > 0) {
          bankAccountId = accounts[0].id;
          debug.log("Etherfuse", "Using existing bank account:", bankAccountId);
        } else {
          bankAccountId = crypto.randomUUID();
          debug.log("Etherfuse", "No bank accounts found, generating:", bankAccountId);
        }
      } catch {
        bankAccountId = crypto.randomUUID();
        debug.log("Etherfuse", "Could not fetch accounts, generating:", bankAccountId);
      }
    }

    try {
      // Response may be nested: {"onramp": {...}} or flat
      const rawResponse = await this.request<{
        onramp?: {
          orderId: string;
          customerId: string;
          status: string;
          sourceAmount: string;
          sourceAsset: string;
          destinationAmount: string;
          destinationAsset: string;
          destinationAddress: string;
          depositClabe: string;
          depositAmount: string;
          depositReference: string;
          beneficiaryName: string;
          beneficiaryBank: string;
          createdAt: string;
        };
        orderId?: string;
      }>("POST", "/ramp/order", {
        orderId,
        customerId: input.customerId,
        quoteId: input.quoteId,
        publicKey: input.destinationAddress,
        bankAccountId,
      });

      debug.log("Etherfuse", "createOnRamp raw response:", rawResponse);

      // Unwrap nested response
      const response = rawResponse.onramp || rawResponse as {
        orderId?: string;
        customerId?: string;
        status?: string;
        sourceAmount?: string;
        sourceAsset?: string;
        destinationAmount?: string;
        destinationAsset?: string;
        destinationAddress?: string;
        depositClabe?: string;
        depositAmount?: string;
        depositReference?: string;
        beneficiaryName?: string;
        beneficiaryBank?: string;
        createdAt?: string;
      };

      return {
        id: response.orderId || orderId, // Fall back to our generated orderId
        customerId: response.customerId || input.customerId,
        status: (response.status as OnRampTransaction["status"]) || "pending",
        sourceAmount: response.sourceAmount || "0",
        sourceAsset: response.sourceAsset || "MXN",
        destinationAmount: response.destinationAmount || "0",
        destinationAsset: response.destinationAsset || "CETES",
        destinationAddress: response.destinationAddress || input.destinationAddress,
        paymentInstructions: {
          type: "spei",
          clabe: response.depositClabe || "",
          beneficiary: response.beneficiaryName || "",
          bank: response.beneficiaryBank || "",
          amount: response.depositAmount || "",
          currency: "MXN",
          reference: response.depositReference || "",
        },
        createdAt: response.createdAt || new Date().toISOString(),
        updatedAt: response.createdAt || new Date().toISOString(),
      };
    } catch (error) {
      // Check if user needs to complete T&C onboarding
      if (error instanceof AnchorError && error.message.includes("Terms and conditions")) {
        // Get onboarding URL for the user
        const onboardingResponse = await this.request<{ presigned_url: string }>(
          "POST",
          "/ramp/onboarding-url",
          {
            customerId: input.customerId,
            bankAccountId,
            publicKey: input.destinationAddress,
            blockchain: "stellar",
          }
        );
        throw new AnchorError(
          `Please complete Etherfuse onboarding first: ${onboardingResponse.presigned_url}`,
          "ONBOARDING_REQUIRED",
          400
        );
      }
      throw error;
    }
  }

  async getOnRampTransaction(
    transactionId: string
  ): Promise<OnRampTransaction | null> {
    const response = await this.request<{
      orderId: string;
      customerId: string;
      status: string;
      sourceAmount: string;
      sourceAsset: string;
      destinationAmount: string;
      destinationAsset: string;
      destinationAddress: string;
      stellarTxHash?: string;
      depositClabe?: string;
      depositAmount?: string;
      depositReference?: string;
      beneficiaryName?: string;
      beneficiaryBank?: string;
      createdAt: string;
      updatedAt: string;
    }>("GET", `/ramp/order/${transactionId}`);

    if (!response) return null;

    return {
      id: response.orderId,
      customerId: response.customerId,
      status: response.status as OnRampTransaction["status"],
      sourceAmount: response.sourceAmount,
      sourceAsset: response.sourceAsset,
      destinationAmount: response.destinationAmount,
      destinationAsset: response.destinationAsset,
      destinationAddress: response.destinationAddress,
      stellarTxHash: response.stellarTxHash,
      paymentInstructions: response.depositClabe
        ? {
            type: "spei",
            clabe: response.depositClabe,
            beneficiary: response.beneficiaryName || "",
            bank: response.beneficiaryBank || "",
            amount: response.depositAmount || "",
            currency: "MXN",
            reference: response.depositReference || "",
          }
        : undefined,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  async createOffRamp(input: CreateOffRampInput): Promise<OffRampTransaction> {
    // Generate orderId (Etherfuse expects UUID)
    const orderId = crypto.randomUUID();

    // Response is nested: {"offramp": {...}}
    const rawResponse = await this.request<{
      offramp?: {
        orderId: string;
        customerId: string;
        status: string;
        sourceAmount: string;
        sourceAsset: string;
        destinationAmount: string;
        destinationAsset: string;
        bankAccountId: string;
        createdAt: string;
      };
      orderId?: string;
      customerId?: string;
      status?: string;
    }>("POST", "/ramp/order", {
      orderId,
      customerId: input.customerId,
      quoteId: input.quoteId,
      bankAccountId: input.bankAccountId,
      publicKey: input.publicKey,
      blockchain: "stellar",
      type: "offramp",
    });

    debug.log("Etherfuse", "createOffRamp raw response:", rawResponse);

    // Unwrap nested response
    const response = rawResponse.offramp || rawResponse as {
      orderId?: string;
      customerId?: string;
      status?: string;
      sourceAmount?: string;
      sourceAsset?: string;
      destinationAmount?: string;
      destinationAsset?: string;
      bankAccountId?: string;
      createdAt?: string;
    };

    return {
      id: response.orderId || orderId, // Fall back to our generated orderId
      customerId: response.customerId || input.customerId,
      status: (response.status as OffRampTransaction["status"]) || "pending",
      sourceAmount: response.sourceAmount || "0",
      sourceAsset: response.sourceAsset || "CETES",
      destinationAmount: response.destinationAmount || "0",
      destinationAsset: response.destinationAsset || "MXN",
      bankAccountId: response.bankAccountId || input.bankAccountId,
      createdAt: response.createdAt || new Date().toISOString(),
      updatedAt: response.createdAt || new Date().toISOString(),
    };
  }

  async getOffRampTransaction(
    transactionId: string
  ): Promise<OffRampTransaction | null> {
    const response = await this.request<{
      orderId: string;
      customerId: string;
      status: string;
      sourceAmount: string;
      sourceAsset: string;
      destinationAmount: string;
      destinationAsset: string;
      bankAccountId: string;
      burnTransaction?: string;
      stellarTxHash?: string;
      createdAt: string;
      updatedAt: string;
    }>("GET", `/ramp/order/${transactionId}`);

    if (!response) return null;

    return {
      id: response.orderId,
      customerId: response.customerId,
      status: response.status as OffRampTransaction["status"],
      sourceAmount: response.sourceAmount,
      sourceAsset: response.sourceAsset,
      destinationAmount: response.destinationAmount,
      destinationAsset: response.destinationAsset,
      bankAccountId: response.bankAccountId,
      signableTransaction: response.burnTransaction,
      stellarTxHash: response.stellarTxHash,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  async registerFiatAccount(
    input: RegisterFiatAccountInput
  ): Promise<FiatAccount> {
    const response = await this.request<{
      id: string;
      bankName: string;
      clabe: string;
      holderName: string;
    }>("POST", "/ramp/bank-account", {
      customerId: input.customerId,
      clabe: input.clabe,
      holderName: input.holderName,
    });

    return {
      id: response.id,
      bankName: response.bankName,
      clabe: response.clabe,
      holderName: response.holderName,
      isDefault: true,
    };
  }

  async getFiatAccounts(customerId: string): Promise<FiatAccount[]> {
    const response = await this.request<{
      accounts: Array<{
        id: string;
        bankName: string;
        clabe: string;
        holderName: string;
        isDefault: boolean;
      }>;
    }>("POST", `/ramp/customer/${customerId}/bank-accounts`, {});

    return response.accounts || [];
  }

  // Sandbox helper - simulate fiat received
  async simulateFiatReceived(orderId: string): Promise<void> {
    await this.request("POST", "/ramp/order/fiat_received", {
      orderId,
    });
  }
}
