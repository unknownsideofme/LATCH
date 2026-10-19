import { Router } from "express";
import { WebhookController } from "../controllers/webhookController.js";

const router = Router();

router.post("/render", WebhookController.handleRender);

export default router;
