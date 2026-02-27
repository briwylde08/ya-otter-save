import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAnchorClient } from "@/lib/anchor/server";
import { quoteRequestSchema, validateRequest } from "@/lib/validation";
import { debug } from "@/lib/debug";

const CUSTOMER_ID_COOKIE = "etherfuse_customer_id";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = validateRequest(quoteRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { sourceAsset, destinationAsset, sourceAmount, destinationAmount, publicKey } = validation.data;

    // Get customer ID from cookie if available
    const cookieStore = await cookies();
    const storedCustomerId = cookieStore.get(CUSTOMER_ID_COOKIE)?.value;

    const anchor = getAnchorClient(storedCustomerId);
    const quote = await anchor.getQuote({
      sourceAsset,
      destinationAsset,
      sourceAmount,
      destinationAmount,
      publicKey,
    });

    // If quote returns a customerId, store it in cookie
    const response = NextResponse.json(quote);
    if (quote.customerId) {
      response.cookies.set(CUSTOMER_ID_COOKIE, quote.customerId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return response;
  } catch (error) {
    debug.error("API", "Quote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get quote" },
      { status: 500 }
    );
  }
}
