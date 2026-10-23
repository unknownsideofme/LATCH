"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, CheckCircle2, Loader2, CreditCard } from "lucide-react";
import { api } from "@/lib/api";

interface PayPalButtonProps {
  seats?: number;
  userId?: string;
  onSuccess?: (details: any) => void;
  onError?: (error: any) => void;
}

export function PayPalSubscriptionButton({
  seats = 1,
  userId,
  onSuccess,
  onError,
}: PayPalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Initializing secure checkout...");

    try {
      const orderRes = await api.billing.createOrder(seats);

      if (!orderRes?.orderId || !orderRes?.approveUrl) {
        throw new Error("Failed to initialize PayPal order");
      }

      // Store orderId in sessionStorage so the return page can capture it
      sessionStorage.setItem("latch_paypal_order_id", orderRes.orderId);
      sessionStorage.setItem("latch_paypal_seats", String(seats));

      setStatusMessage("Opening PayPal checkout window...");

      // Open in a focused popup/new window to prevent parent page reload
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2.5;

      const popup = window.open(
        orderRes.approveUrl,
        "PayPalCheckout",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );

      // Listen for message from popup upon payment completion/failure
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "PAYPAL_PAYMENT_SUCCESS") {
          window.removeEventListener("message", handleMessage);
          setStatusMessage("Payment completed successfully!");
          if (onSuccess) onSuccess(event.data.payload);
        } else if (event.data?.type === "PAYPAL_PAYMENT_FAILED") {
          window.removeEventListener("message", handleMessage);
          setErrorMessage(event.data?.message || "Payment was cancelled or failed.");
          setLoading(false);
          setStatusMessage(null);
          if (onError) onError(event.data);
        }
      };

      window.addEventListener("message", handleMessage);

      // Also monitor if user closed popup without paying
      const checkPopupClosed = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(checkPopupClosed);
          window.removeEventListener("message", handleMessage);
          setLoading(false);
          setStatusMessage(null);
        }
      }, 1000);
    } catch (err: any) {
      console.error("[paypal] checkout error:", err);
      const msg = err.message || "Failed to initiate checkout";
      setErrorMessage(msg);
      setLoading(false);
      setStatusMessage(null);
      if (onError) onError(err);
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

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full py-3.5 px-6 rounded-lg bg-primary hover:opacity-90 disabled:opacity-60 text-primary-foreground font-semibold text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2.5 border border-primary/50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4.5 h-4.5 animate-spin" />
            <span>Redirecting to PayPal...</span>
          </>
        ) : (
          <>
            <CreditCard className="w-4.5 h-4.5" />
            <span>Pay with PayPal</span>
          </>
        )}
      </button>

      <p className="text-[10px] text-muted-foreground text-center font-mono">
        Secure checkout powered by PayPal · 256-bit SSL encryption
      </p>
    </div>
  );
}
