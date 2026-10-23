import { Router } from "express";
import { BillingController } from "../controllers/billingController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Authenticated billing routes (protected by session cookie / Bearer token)
router.post("/create-order", requireAuth, BillingController.createOrder);
router.post("/capture-order", requireAuth, BillingController.captureOrder);
router.get("/status", requireAuth, BillingController.getStatus);

// Public PayPal webhook endpoint (verified cryptographically)
router.post("/webhook", BillingController.handleWebhook);

export default router;
