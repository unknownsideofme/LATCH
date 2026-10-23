import { Client, Environment, LogLevel, OrdersController } from "@paypal/paypal-server-sdk";
import { config } from "../config/env.js";

// Startup guard against insecure webhook bypass in production
if (config?.isProd && (config?.paypal?.bypassWebhookVerification || process.env.PAYPAL_BYPASS_WEBHOOK_VERIFICATION === "true")) {
  throw new Error("FATAL: PAYPAL_BYPASS_WEBHOOK_VERIFICATION cannot be enabled in production environments.");
}

export class PayPalService {
  constructor() {
    this.clientId = config?.paypal?.clientId || process.env.PAYPAL_CLIENT_ID || "";
    this.clientSecret = config?.paypal?.clientSecret || process.env.PAYPAL_CLIENT_SECRET || "";
    this.mode = config?.paypal?.mode || process.env.PAYPAL_MODE || "sandbox";
    this.webhookId = config?.paypal?.webhookId || process.env.PAYPAL_WEBHOOK_ID || "";

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
        logLevel: config?.isProd ? LogLevel.Warn : LogLevel.Info,
      },
    });

    this.ordersController = new OrdersController(this.client);
    this.baseUrl = this.mode === "live" || this.mode === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    this._cachedToken = null;
    this._tokenExpiresAt = 0;
  }

  /**
   * Internal OAuth token fetcher for direct PayPal REST calls (like webhook verification).
   */
  async getAccessToken() {
    const now = Date.now();
    if (this._cachedToken && now < this._tokenExpiresAt - 60000) {
      return this._cachedToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing");
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
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

  /**
   * Create a One-Time Order for 30-day Pro Swarm access ($24/seat).
   */
  async createOrder({ seats = 1, userId }) {
    const seatCount = Math.max(1, parseInt(seats, 10) || 1);
    const totalAmount = (seatCount * 24).toFixed(2);

    const returnUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const response = await this.ordersController.createOrder({
      body: {
        intent: "CAPTURE",
        applicationContext: {
          returnUrl: `${returnUrl}/dashboard/payment-return`,
          cancelUrl: `${returnUrl}/dashboard/payment-return?status=cancelled`,
          brandName: "LATCH Systems",
          userAction: "PAY_NOW",
          shippingPreference: "NO_SHIPPING",
        },
        purchaseUnits: [
          {
            referenceId: `latch_pro_${userId || "user"}_${Date.now()}`,
            description: `LATCH Pro Swarm - 30-Day Access (${seatCount} seat${seatCount > 1 ? "s" : ""})`,
            customId: String(userId || "anonymous"),
            amount: {
              currencyCode: "USD",
              value: totalAmount,
              breakdown: {
                itemTotal: {
                  currencyCode: "USD",
                  value: totalAmount,
                },
              },
            },
            items: [
              {
                name: "LATCH Pro Swarm 30-Day Pass",
                description: "30-day Pro swarm access with 50 project capacity and sub-ms lock arbitration",
                quantity: String(seatCount),
                unitAmount: {
                  currencyCode: "USD",
                  value: "24.00",
                },
                category: "DIGITAL_GOODS",
              },
            ],
          },
        ],
      },
    });

    // Extract approval URL for redirect flow
    const links = response.result.links || [];
    const approveLink = links.find(l => l.rel === "approve" || l.rel === "payer-action");
    const approveUrl = approveLink?.href || null;

    return {
      orderId: response.result.id,
      status: response.result.status,
      seats: seatCount,
      amount: totalAmount,
      approveUrl,
    };
  }

  /**
   * Capture an authorized One-Time PayPal Order.
   */
  async captureOrder({ orderId }) {
    if (!orderId) throw new Error("orderId is required to capture payment");

    try {
      const response = await this.ordersController.captureOrder({
        id: orderId,
      });

      const result = response.result;
      const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];

      return {
        status: result.status, // e.g. "COMPLETED"
        orderId: result.id,
        captureId: capture?.id || null,
        amount: capture?.amount?.value || null,
        currency: capture?.amount?.currencyCode || "USD",
        payerEmail: result.payer?.emailAddress || null,
        payerId: result.payer?.payerId || null,
        raw: result,
      };
    } catch (err) {
      // Idempotency: If PayPal returns ORDER_ALREADY_CAPTURED, retrieve the order details instead of failing!
      const errorBody = err?.body || err?.message || "";
      const isAlreadyCaptured = typeof errorBody === "string" && errorBody.includes("ORDER_ALREADY_CAPTURED");

      if (isAlreadyCaptured || err?.statusCode === 422) {
        try {
          const getOrderRes = await this.ordersController.getOrder({ id: orderId });
          const orderData = getOrderRes.result;
          if (orderData.status === "COMPLETED") {
            const capture = orderData.purchaseUnits?.[0]?.payments?.captures?.[0];
            return {
              status: "COMPLETED",
              orderId: orderData.id,
              captureId: capture?.id || null,
              amount: capture?.amount?.value || null,
              currency: capture?.amount?.currencyCode || "USD",
              payerEmail: orderData.payer?.emailAddress || null,
              payerId: orderData.payer?.payerId || null,
              raw: orderData,
            };
          }
        } catch (fetchErr) {
          console.warn("[paypal] Could not retrieve order after ORDER_ALREADY_CAPTURED:", fetchErr.message);
        }
      }

      throw err;
    }
  }

  /**
   * Cryptographically verify PayPal Webhook signatures.
   */
  async verifyWebhookSignature({ headers, rawBody }) {
    if (config.paypal.bypassWebhookVerification) {
      if (config.isProd) {
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

    // Verify certUrl is on an official PayPal domain
    try {
      const parsedCert = new URL(certUrl);
      if (!parsedCert.hostname.endsWith(".paypal.com")) {
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
        Authorization: `Bearer ${token}`,
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

export const paypalService = new PayPalService();
