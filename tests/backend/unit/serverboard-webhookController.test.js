import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

let dbUpdateResult = { error: null };
let lastDbUpdate = null;

function createQueryMock() {
  const query = {
    update: vi.fn((data) => {
      lastDbUpdate = data;
      return query;
    }),
    eq: vi.fn(async () => dbUpdateResult),
  };
  return query;
}

vi.mock("../../../serverboard/config/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => createQueryMock()),
  },
}));

vi.mock("../../../serverboard/config/env.js", () => ({
  config: {
    isProd: false,
    webhookSecret: "test-webhook-secret-key",
  },
}));

import { WebhookController } from "../../../serverboard/controllers/webhookController.js";
import { config } from "../../../serverboard/config/env.js";
import { supabase } from "../../../serverboard/config/supabase.js";

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  return res;
}

function generateSignature(body, secret, timestamp = null) {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  const payloadToHash = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const hash = crypto.createHmac("sha256", secret).update(payloadToHash).digest("hex");
  return timestamp ? `t=${timestamp},v1=${hash}` : hash;
}

describe("WebhookController (serverboard/controllers/webhookController.js)", () => {
  const secret = "test-webhook-secret-key";

  beforeEach(() => {
    vi.clearAllMocks();
    config.isProd = false;
    config.webhookSecret = secret;
    dbUpdateResult = { error: null };
    lastDbUpdate = null;
  });

  describe("HMAC-SHA256 signature verification", () => {
    it("accepts valid Render timestamped signature (t=...,v1=...)", async () => {
      const payload = { type: "deploy_succeeded", service: { id: "srv-1" } };
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, secret, timestamp);

      const req = {
        headers: { "render-signature": signature },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ received: true, renderId: "srv-1", status: "running" });
    });

    it("accepts valid raw hash signature with x-render-signature header", async () => {
      const payload = { type: "deploy_succeeded", service: { id: "srv-2" } };
      const signature = generateSignature(payload, secret);

      const req = {
        headers: { "x-render-signature": signature },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(200);
      expect(res._body.renderId).toBe("srv-2");
    });

    it.each([
      [{}, "missing signature header"],
      [{ "render-signature": "" }, "empty signature header"],
      [{ "render-signature": "invalid-hex" }, "invalid hex format"],
      [{ "render-signature": "t=123,v1=badhash0000000000000000000000000000000000000000000000000000000000" }, "tampered hash"],
      [{ "render-signature": "t=123,v1=1234" }, "short signature"],
    ])("rejects signature failure with 401 (%s)", async (headers) => {
      const payload = { type: "deploy_succeeded", service: { id: "srv-1" } };
      const req = { headers, body: payload };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ error: "invalid_signature" });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("returns 500 when webhookSecret is missing in production", async () => {
      config.isProd = true;
      config.webhookSecret = null;

      const req = { headers: {}, body: {} };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(500);
      expect(res._body).toEqual({ error: "webhook_not_configured" });
    });

    it("bypasses signature verification in development when webhookSecret is absent", async () => {
      config.isProd = false;
      config.webhookSecret = null;

      const payload = { type: "deploy_succeeded", service: { id: "srv-dev" } };
      const req = { headers: {}, body: payload };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ received: true, renderId: "srv-dev", status: "running" });
    });
  });

  describe("Ping request without service ID", () => {
    it("returns 200 ping acknowledged when service ID is missing", async () => {
      const payload = { type: "ping" };
      const req = {
        headers: { "render-signature": generateSignature(payload, secret) },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ received: true, message: "Ping acknowledged" });
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe("Event to project status mapping", () => {
    test.each([
      [{ type: "deploy_succeeded" }, "running"],
      [{ deploy: { status: "live" } }, "running"],
      [{ type: "deploy_failed" }, "failed"],
      [{ deploy: { status: "build_failed" } }, "failed"],
      [{ deploy: { status: "update_failed" } }, "failed"],
      [{ type: "deploy_started" }, "deploying"],
      [{ deploy: { status: "build_in_progress" } }, "deploying"],
      [{ deploy: { status: "update_in_progress" } }, "deploying"],
      [{ deploy: { status: "canceled" } }, "canceled"],
    ])("maps payload %o to status '%s'", async (eventData, expectedStatus) => {
      const payload = {
        service: { id: "srv-mapped", serviceDetails: { url: "https://srv.onrender.com" } },
        ...eventData,
      };
      const req = {
        headers: { "render-signature": generateSignature(payload, secret) },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(200);
      expect(res._body.status).toBe(expectedStatus);
      expect(lastDbUpdate).toEqual({
        status: expectedStatus,
        render_url: "https://srv.onrender.com",
      });
    });

    it("prefers service.url if serviceDetails.url is not present", async () => {
      const payload = {
        type: "deploy_succeeded",
        service: { id: "srv-url", url: "https://direct.onrender.com" },
      };
      const req = {
        headers: { "render-signature": generateSignature(payload, secret) },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(lastDbUpdate).toEqual({
        status: "running",
        render_url: "https://direct.onrender.com",
      });
    });

    it("accepts payload.serviceId as fallback for service.id", async () => {
      const payload = {
        type: "deploy_succeeded",
        serviceId: "srv-fallback-id",
      };
      const req = {
        headers: { "render-signature": generateSignature(payload, secret) },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._body.renderId).toBe("srv-fallback-id");
      expect(lastDbUpdate).toEqual({ status: "running" });
    });

    it("ignores unknown events without updating database", async () => {
      const payload = {
        type: "some_unhandled_event",
        service: { id: "srv-unknown" },
      };
      const req = {
        headers: { "render-signature": generateSignature(payload, secret) },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ received: true, renderId: "srv-unknown", status: null });
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("returns 500 when database update returns an error so Render can retry", async () => {
      dbUpdateResult = { error: { message: "DB write deadlock" } };
      const payload = { type: "deploy_succeeded", service: { id: "srv-err" } };
      const req = {
        headers: { "render-signature": generateSignature(payload, secret) },
        body: payload,
      };
      const res = makeRes();

      await WebhookController.handleRender(req, res, vi.fn());

      expect(res._status).toBe(500);
      expect(res._body).toEqual({
        error: "database_update_failed",
        message: "DB write deadlock",
      });
    });

    it("passes unexpected runtime exceptions to next(err)", async () => {
      const runtimeError = new Error("Unexpected crash");
      supabase.from.mockImplementation(() => {
        throw runtimeError;
      });

      const payload = { type: "deploy_succeeded", service: { id: "srv-crash" } };
      const req = {
        headers: { "render-signature": generateSignature(payload, secret) },
        body: payload,
      };
      const res = makeRes();
      const next = vi.fn();

      await WebhookController.handleRender(req, res, next);

      expect(next).toHaveBeenCalledWith(runtimeError);
    });
  });
});

