"use client";

import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";

interface PayPalSubscriptionButtonProps {
  planId?: string;
  seats?: number;
  userId?: string;
  organizationId?: string | null;
  onSuccess?: (details: any) => void;
  onError?: (error: any) => void;
}

export function PayPalSubscriptionButton({
  planId = process.env.NEXT_PUBLIC_PAYPAL_PRO_PLAN_ID || "P-MOCK-PRO-PLAN",
  seats = 1,
  userId,
  organizationId,
  onSuccess,
  onError,
}: PayPalSubscriptionButtonProps) {
  const [verifying, setVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "sb";

  const handleApprove = async (data: any, actions: any) => {
    setVerifying(true);
    setStatusMessage("Verifying subscription and initial payment with PayPal...");
    setErrorMessage(null);

    try {
      const response = await fetch("http://127.0.0.1:3001/api/billing/paypal/verify-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId || "",
        },
        body: JSON.stringify({
          subscriptionId: data.subscriptionID,
          seats: seats,
          organizationId: organizationId || null,
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "Subscription verification failed on server");
      }

      setStatusMessage("Subscription activated! Unlocking Pro Swarm features...");
      if (onSuccess) {
        onSuccess(resData);
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      const msg = err.message || "Failed to confirm payment with backend";
      setErrorMessage(msg);
      if (onError) onError(err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {errorMessage && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusMessage && !errorMessage && (
        <div className="p-3 rounded-md bg-primary/10 border border-primary/30 flex items-center gap-2 text-xs text-primary font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {verifying ? (
        <div className="p-4 rounded-md bg-muted border border-border flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground animate-pulse">
          <Sparkles className="w-4 h-4 text-primary animate-spin" />
          <span>Arbitrating subscription state...</span>
        </div>
      ) : (
        <div className="w-full min-h-[44px]">
          <PayPalScriptProvider
            options={{
              clientId: clientId,
              intent: "subscription",
              vault: true,
              components: "buttons",
            }}
          >
            <PayPalButtons
              style={{
                shape: "rect",
                color: "gold",
                layout: "vertical",
                label: "subscribe",
                height: 44,
              }}
              createSubscription={(data, actions) => {
                return actions.subscription.create({
                  plan_id: planId,
                  quantity: String(seats),
                  custom_id: userId || "user_checkout",
                });
              }}
              onApprove={handleApprove}
              onError={(err) => {
                console.error("PayPal Smart Button error:", err);
                setErrorMessage("An error occurred during PayPal checkout.");
                if (onError) onError(err);
              }}
              onCancel={() => {
                setStatusMessage("Checkout cancelled.");
              }}
            />
          </PayPalScriptProvider>
        </div>
      )}
    </div>
  );
}
