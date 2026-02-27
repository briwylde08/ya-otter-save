import { NextRequest, NextResponse } from "next/server";
import { getEtherfuseClient } from "@/lib/anchor/server";
import { mockAnchor } from "@/lib/anchor";
import { simulatePaymentRequestSchema, validateRequest } from "@/lib/validation";
import { debug } from "@/lib/debug";

// Check if string is a valid UUID format
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validation = validateRequest(simulatePaymentRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { transactionId } = validation.data;

    const useMock = process.env.USE_MOCK_ANCHOR === "true";

    // If transaction ID is not a UUID, it's from mock (mock uses short IDs)
    const isMockOrder = !isUUID(transactionId);

    if (useMock || isMockOrder) {
      // Use mock for demo/testing or for mock-created orders
      debug.log("API", "Using mock simulate for order:", transactionId);
      await mockAnchor.simulateOnRampComplete(transactionId);
    } else {
      // Try to use real Etherfuse client
      const etherfuseClient = getEtherfuseClient();

      if (etherfuseClient) {
        // Call the real Etherfuse sandbox endpoint to simulate fiat received
        // This will trigger Etherfuse to mint CETES to the destination wallet
        debug.log("API", "Calling Etherfuse fiat_received for order:", transactionId);
        await etherfuseClient.simulateFiatReceived(transactionId);
        debug.log("API", "Etherfuse fiat_received completed");
      } else {
        // Fall back to mock
        debug.log("API", "No Etherfuse client, using mock simulate for order:", transactionId);
        await mockAnchor.simulateOnRampComplete(transactionId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    debug.error("API", "Simulate payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to simulate payment" },
      { status: 500 }
    );
  }
}
