"use strict";

import { test, expect, describe, vi, beforeEach, afterEach } from "vitest";
import { PayPalService } from "../../../serverboard/services/paypalService.js";
import { BillingController } from "../../../serverboard/controllers/billingController.js";

describe("PayPalService (serverboard/services/paypalService.js)", () => {
  test("initializes with sandbox mode and correct base URL", () => {
    const service = new PayPalService();
    expect(service.mode).toBe("sandbox");
    expect(service.baseUrl).toBe("https://api-m.sandbox.paypal.com");
  });

  test("rejects webhook verification when required signature headers are missing", async () => {
    const service = new PayPalService();
    const result = await service.verifyWebhookSignature({
      headers: {},
      rawBody: JSON.stringify({ id: "WH-TEST" }),
    });

    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/Missing required PayPal signature headers/);
  });

  test("rejects webhook signatures with non-paypal domain in cert-url", async () => {
    const service = new PayPalService();
    const result = await service.verifyWebhookSignature({
      headers: {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://malicious-site.com/cert.pem",
        "paypal-transmission-id": "test-id",
        "paypal-transmission-sig": "test-sig",
        "paypal-transmission-time": "2026-10-23T00:00:00Z",
      },
      rawBody: JSON.stringify({ id: "WH-TEST" }),
    });

    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/Untrusted cert-url hostname/);
  });
});

describe("BillingController (serverboard/controllers/billingController.js)", () => {
  test("createOrder requires authenticated user session", async () => {
    const req = { user: null, body: { seats: 2 } };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await BillingController.createOrder(req, res);
    expect(statusCode).toBe(401);
    expect(jsonBody?.error).toBe("unauthorized");
  });

  test("captureOrder requires orderId in request body", async () => {
    const req = { user: { id: "test-user-uuid" }, body: {} };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await BillingController.captureOrder(req, res);
    expect(statusCode).toBe(400);
    expect(jsonBody?.error).toBe("bad_request");
  });

  test("getStatus returns free plan defaults when user is unauthenticated", async () => {
    const req = { user: null };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await BillingController.getStatus(req, res);
    expect(statusCode).toBe(200);
    expect(jsonBody?.planTier).toBe("free");
    expect(jsonBody?.projectLimit).toBe(2);
  });
});
