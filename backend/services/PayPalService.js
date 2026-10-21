"use strict";

const { Client, Environment, LogLevel, SubscriptionsController } = require("@paypal/paypal-server-sdk");

// Startup guard against insecure webhook bypass in production
if (process.env.NODE_ENV === "production" && process.env.PAYPAL_BYPASS_WEBHOOK_VERIFICATION === "true") {
  throw new Error("FATAL: PAYPAL_BYPASS_WEBHOOK_VERIFICATION cannot be enabled in production environments.");
}

class PayPalService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || "";
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    this.mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
    this.proPlanId = process.env.PAYPAL_PRO_PLAN_ID || "";
    this.webhookId = process.env.PAYPAL_WEBHOOK_ID || "";

    const environment = this.mode === "live" || this.mode === "production"
      ? Environment.Production
      : Environment.Sandbox;

    this.client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: this.clientId,
        oAuthClientSecret: this.clientSecret,
      },
      environment,
      logging: {
        logLevel: process.env.NODE_ENV === "production" ? LogLevel.Warn : LogLevel.Info,
      },
    });

    this.subscriptionsController = new SubscriptionsController(this.client);
    this.baseUrl = this.mode === "live" || this.mode === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    this._cachedToken = null;
    this._tokenExpiresAt = 0;
  }

  async getAccessToken() {
    const now = Date.now();
    if (this._cachedToken && now < this._tokenExpiresAt - 60000) {
      return this._cachedToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to obtain PayPal OAuth token: ${response.status} ${errText}`);
    }

    const data = await response.json();
    this._cachedToken = data.access_token;
    this._tokenExpiresAt = now + ((data.expires_in || 3600) * 1000);
    return this._cachedToken;
  }

  async getSubscription(subscriptionId) {
    if (!subscriptionId) throw new Error("subscriptionId is required");
    const response = await this.subscriptionsController.getSubscription({ id: subscriptionId });
    return response.result;
  }

  async cancelSubscription(subscriptionId, reason = "Customer requested cancellation") {
    if (!subscriptionId) throw new Error("subscriptionId is required");
    const response = await this.subscriptionsController.cancelSubscription({
      id: subscriptionId,
      body: { reason },
    });
    return response;
  }

  async listSubscriptionTransactions(subscriptionId, startTime, endTime) {
    if (!subscriptionId) throw new Error("subscriptionId is required");
    const now = new Date();
    const end = endTime || now.toISOString();
    const start = startTime || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await this.subscriptionsController.listSubscriptionTransactions({
      id: subscriptionId,
      startTime: start,
      endTime: end,
    });
    return response.result;
  }

  async verifyWebhookSignature({ headers, rawBody }) {
    if (process.env.PAYPAL_BYPASS_WEBHOOK_VERIFICATION === "true") {
      if (process.env.NODE_ENV === "production") {
        throw new Error("SECURITY VIOLATION: Webhook bypass attempted in production.");
      }
      return { verified: true, bypass: true };
    }

    const authAlgo = headers["paypal-auth-algo"];
    const certUrl = headers["paypal-cert-url"];
    const transmissionId = headers["paypal-transmission-id"];
    const transmissionSig = headers["paypal-transmission-sig"];
    const transmissionTime = headers["paypal-transmission-time"];

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      return { verified: false, reason: "Missing required PayPal signature headers" };
    }

    // Restrict certificate URL to official PayPal domains
    try {
      const parsedCert = new URL(certUrl);
      const isOfficialDomain = parsedCert.hostname.endsWith(".paypal.com");
      if (!isOfficialDomain) {
        return { verified: false, reason: "Untrusted cert-url hostname" };
      }
    } catch {
      return { verified: false, reason: "Malformed cert-url" };
    }

    let parsedEvent;
    try {
      parsedEvent = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      return { verified: false, reason: "Invalid JSON webhook payload" };
    }

    const token = await this.getAccessToken();
    const verifyPayload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: this.webhookId,
      webhook_event: parsedEvent,
    };

    const verifyRes = await fetch(`${this.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verifyPayload),
    });

    if (!verifyRes.ok) {
      const errText = await verifyRes.text();
      return { verified: false, reason: `Verification API error: ${verifyRes.status} ${errText}` };
    }

    const verifyData = await verifyRes.json();
    return {
      verified: verifyData.verification_status === "SUCCESS",
      status: verifyData.verification_status,
    };
  }
}

module.exports = {
  PayPalService: new PayPalService(),
  PayPalServiceClass: PayPalService,
};
