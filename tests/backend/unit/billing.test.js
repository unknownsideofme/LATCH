"use strict";

const assert = require("node:assert/strict");
const { PayPalServiceClass } = require("../../../backend/services/PayPalService");
const { requireProEntitlement } = require("../../../backend/middleware/entitlement");
const { createBillingRoutes } = require("../../../backend/routes/billingRoutes");

test("PayPalService: uses Sandbox base URL by default", () => {
  const service = new PayPalServiceClass();
  assert.equal(service.mode, "sandbox");
  assert.equal(service.baseUrl, "https://api-m.sandbox.paypal.com");
});

test("PayPalService: throws fatal error if webhook bypass is enabled in production", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalBypass = process.env.PAYPAL_BYPASS_WEBHOOK_VERIFICATION;

  try {
    process.env.NODE_ENV = "production";
    process.env.PAYPAL_BYPASS_WEBHOOK_VERIFICATION = "true";

    const service = new PayPalServiceClass();
    assert.rejects(
      async () => {
        await service.verifyWebhookSignature({ headers: {}, rawBody: "{}" });
      },
      { message: /SECURITY VIOLATION/ }
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.PAYPAL_BYPASS_WEBHOOK_VERIFICATION = originalBypass;
  }
});

test("PayPalService: rejects webhook signatures with missing required headers", async () => {
  const service = new PayPalServiceClass();
  const result = await service.verifyWebhookSignature({
    headers: {},
    rawBody: JSON.stringify({ id: "WH-123" }),
  });

  assert.equal(result.verified, false);
  assert.match(result.reason, /Missing required PayPal signature headers/);
});

test("PayPalService: rejects webhook signatures with non-paypal domain in cert-url", async () => {
  const service = new PayPalServiceClass();
  const result = await service.verifyWebhookSignature({
    headers: {
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://malicious-site.com/cert.pem",
      "paypal-transmission-id": "test-id",
      "paypal-transmission-sig": "test-sig",
      "paypal-transmission-time": "2026-10-21T00:00:00Z",
    },
    rawBody: JSON.stringify({ id: "WH-123" }),
  });

  assert.equal(result.verified, false);
  assert.match(result.reason, /Untrusted cert-url hostname/);
});

test("billingRoutes: router mounts successfully", () => {
  const router = createBillingRoutes();
  assert.ok(router);
  assert.equal(typeof router, "function");
});

test("requireProEntitlement: blocks requests when user does not have active Pro entitlement", async () => {
  const middleware = requireProEntitlement();
  const req = { headers: {} };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
    setHeader() {},
  };

  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.ok(statusCode === 401 || statusCode === 403);
  assert.ok(responseBody.error === "Unauthorized: Session required" || responseBody.error === "payment_required");
});
