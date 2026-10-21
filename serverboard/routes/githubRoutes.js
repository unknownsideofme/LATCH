import { Router } from "express";
import { GithubController } from "../controllers/githubController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/repos", GithubController.listRepos);

export default router;
