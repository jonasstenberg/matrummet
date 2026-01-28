import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConstructEvent = vi.fn();
const mockStripeInstance = {
  webhooks: { constructEvent: mockConstructEvent },
};

vi.mock("@/lib/stripe", () => ({
  getStripe: () => mockStripeInstance,
}));

vi.mock("@/lib/env", () => ({
  env: {
    POSTGREST_URL: "http://localhost:4444",
    JWT_SECRET: "a".repeat(32),
    POSTGREST_JWT_SECRET: "b".repeat(32),
    STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  },
}));

// Mock jose for the service token creation in addCreditsViaPostgrest
vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock-service-token"; }
  },
}));

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

function webhookRequest(body: string, signature = "valid_sig"): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  it("returns 400 when no stripe-signature header", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/stripe",
      {
        method: "POST",
        body: "{}",
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("No signature");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await POST(webhookRequest("{}", "bad_sig"));
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Invalid signature");
  });

  it("adds credits on checkout.session.completed", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: {
            user_email: "buyer@test.com",
            pack_id: "pack_10",
            credits: "10",
          },
          payment_intent: "pi_test_abc",
        },
      },
    };

    mockConstructEvent.mockReturnValue(event);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => 20,
    });

    const response = await POST(webhookRequest(JSON.stringify(event)));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.received).toBe(true);

    // Verify add_credits was called with correct params
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4444/rpc/add_credits",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          p_user_email: "buyer@test.com",
          p_amount: 10,
          p_transaction_type: "purchase",
          p_description: "Köp av 10 AI-genereringar",
          p_stripe_payment_intent_id: "pi_test_abc",
        }),
      })
    );
  });

  it("passes payment_intent_id for idempotency", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_456",
          metadata: {
            user_email: "buyer@test.com",
            credits: "25",
          },
          payment_intent: "pi_test_idempotent",
        },
      },
    };

    mockConstructEvent.mockReturnValue(event);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => 35,
    });

    await POST(webhookRequest(JSON.stringify(event)));

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.p_stripe_payment_intent_id).toBe("pi_test_idempotent");
  });

  it("returns 500 when credit addition fails (Stripe will retry)", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_fail",
          metadata: {
            user_email: "buyer@test.com",
            credits: "10",
          },
          payment_intent: "pi_test_fail",
        },
      },
    };

    mockConstructEvent.mockReturnValue(event);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const response = await POST(webhookRequest(JSON.stringify(event)));
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBe("Failed to add credits");
  });

  it("returns 400 when checkout session has missing metadata", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_no_meta",
          metadata: {},
          payment_intent: "pi_test_no_meta",
        },
      },
    };

    mockConstructEvent.mockReturnValue(event);

    const response = await POST(webhookRequest(JSON.stringify(event)));
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Missing metadata");
  });

  it("ignores non-checkout events", async () => {
    const event = {
      type: "customer.created",
      data: { object: { id: "cus_test" } },
    };

    mockConstructEvent.mockReturnValue(event);

    const response = await POST(webhookRequest(JSON.stringify(event)));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.received).toBe(true);

    // Should not call PostgREST for non-checkout events
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
