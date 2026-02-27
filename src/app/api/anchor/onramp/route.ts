import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAnchorClient } from "@/lib/anchor/server";
import { mockAnchor } from "@/lib/anchor";
import { AnchorError } from "@/lib/anchor/types";
import { onrampRequestSchema, validateRequest } from "@/lib/validation";
import { debug } from "@/lib/debug";

const CUSTOMER_ID_COOKIE = "etherfuse_customer_id";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = validateRequest(onrampRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { quoteId, destinationAddress, customerId: providedCustomerId } = validation.data;

    const anchor = getAnchorClient();

    // Use provided customerId from quote, cookie-stored ID, or create a new customer
    const cookieStore = await cookies();
    const storedCustomerId = cookieStore.get(CUSTOMER_ID_COOKIE)?.value;

    let customerId = providedCustomerId || storedCustomerId;

    if (!customerId) {
      const customer = await anchor.createCustomer({
        email: "demo@example.com",
        publicKey: destinationAddress,
        country: "MX",
      });
      customerId = customer.id;
      debug.log("API", "Created new customer:", customerId);
    }

    try {
      const transaction = await anchor.createOnRamp({
        customerId,
        quoteId,
        destinationAddress,
      });

      // Store customer ID in cookie for future requests (30 days)
      const response = NextResponse.json(transaction);
      response.cookies.set(CUSTOMER_ID_COOKIE, customerId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
      return response;
    } catch (etherfuseError) {
      // Check if this is an onboarding required error
      if (etherfuseError instanceof AnchorError && etherfuseError.code === "ONBOARDING_REQUIRED") {
        // Extract onboarding URL from the error message
        const urlMatch = etherfuseError.message.match(/https:\/\/[^\s]+/);
        const onboardingUrl = urlMatch ? urlMatch[0] : null;

        debug.log("API", "Onboarding required, URL:", onboardingUrl);

        return NextResponse.json({
          error: "Onboarding required",
          code: "ONBOARDING_REQUIRED",
          onboardingUrl,
          message: "Please complete Etherfuse onboarding for this wallet before on-ramping.",
        }, { status: 400 });
      }

      // Fall back to mock for other errors
      debug.log("API", "Etherfuse order failed, falling back to mock:", etherfuseError);
      const mockTransaction = await mockAnchor.createOnRamp({
        customerId,
        quoteId,
        destinationAddress,
      });
      return NextResponse.json(mockTransaction);
    }
  } catch (error) {
    debug.error("API", "OnRamp error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create on-ramp" },
      { status: 500 }
    );
  }
}
