import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchor/server";
import { offrampRequestSchema, validateRequest } from "@/lib/validation";
import { debug } from "@/lib/debug";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = validateRequest(offrampRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { quoteId, customerId, sourceAddress } = validation.data;

    const anchor = getAnchorClient();

    // Get the bank account ID from env (same as onramp - must match onboarding)
    const bankAccountId = process.env.ETHERFUSE_BANK_ACCOUNT_ID;
    if (!bankAccountId) {
      return NextResponse.json(
        { error: "Bank account not configured" },
        { status: 500 }
      );
    }

    const transaction = await anchor.createOffRamp({
      customerId,
      quoteId,
      bankAccountId,
      publicKey: sourceAddress,
    });

    return NextResponse.json(transaction);
  } catch (error) {
    debug.error("API", "OffRamp error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create off-ramp" },
      { status: 500 }
    );
  }
}
