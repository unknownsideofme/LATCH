import { Router } from "express";
import { ProjectController } from "../controllers/projectController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/", ProjectController.create);
router.get("/", ProjectController.list);
router.get("/:id", ProjectController.get);
router.delete("/:id", ProjectController.delete);
router.get("/:id/logs", ProjectController.logs);
router.get("/:id/deploys", ProjectController.deploys);
router.get("/:id/health", ProjectController.health);

export default router;
