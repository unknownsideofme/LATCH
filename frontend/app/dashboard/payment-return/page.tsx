"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function PaymentReturnPage() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;

    async function captureAndClose() {
      if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get("status");

      if (statusParam === "cancelled") {
        setStatus("error");
        setErrorMessage("Payment was cancelled.");
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "PAYPAL_PAYMENT_FAILED", message: "Payment was cancelled. No charges were made." },
            window.location.origin
          );
          setTimeout(() => window.close(), 600);
        } else {
          setTimeout(() => window.location.href = "/dashboard?payment=cancelled", 800);
        }
        return;
      }

      const token = params.get("token"); // PayPal Order ID
      const storedOrderId = sessionStorage.getItem("latch_paypal_order_id");
      const seats = parseInt(sessionStorage.getItem("latch_paypal_seats") || "1", 10);
      const orderId = token || storedOrderId;

      if (!orderId) {
        setStatus("error");
        setErrorMessage("No order token provided.");
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "PAYPAL_PAYMENT_FAILED", message: "No order token provided." },
            window.location.origin
          );
          setTimeout(() => window.close(), 1500);
        }
        return;
      }

      try {
        const captureRes = await api.billing.captureOrder(orderId, seats);

        if (!captureRes?.ok || captureRes.status !== "COMPLETED") {
          throw new Error(captureRes?.status ? `Payment status: ${captureRes.status}` : "Capture failed");
        }

        // Clean up sessionStorage
        sessionStorage.removeItem("latch_paypal_order_id");
        sessionStorage.removeItem("latch_paypal_seats");

        setStatus("success");

        // Notify parent window that payment succeeded, then instantly close popup!
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "PAYPAL_PAYMENT_SUCCESS", payload: captureRes },
            window.location.origin
          );
          setTimeout(() => {
            window.close();
          }, 800);
        } else {
          // Fallback if user navigated directly here without opener
          setTimeout(() => {
            window.location.href = "/dashboard?payment=success";
          }, 1200);
        }
      } catch (err: any) {
        console.error("[payment-return] Capture error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to finalize payment");

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "PAYPAL_PAYMENT_FAILED", message: err.message || "Payment capture failed" },
            window.location.origin
          );
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      }
    }

    captureAndClose();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 text-center">
      {status === "processing" && (
        <div className="space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
          <h2 className="text-base font-semibold font-mono">Securing Payment & Activating Pro Swarm...</h2>
          <p className="text-xs text-muted-foreground font-mono">Closing this window automatically in a second.</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-3">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto animate-bounce" />
          <h2 className="text-base font-semibold font-mono text-primary">Payment Confirmed!</h2>
          <p className="text-xs text-muted-foreground font-mono">Closing popup and returning to your workspace...</p>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-base font-semibold font-mono text-destructive">Payment Incomplete</h2>
          <p className="text-xs text-muted-foreground font-mono">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
