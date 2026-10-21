import { Router } from "express";
import { GithubController } from "../controllers/githubController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/repos", (req, res, next) => {
  if (typeof GithubController?.listRepos === "function") {
    return GithubController.listRepos(req, res, next);
  }
  return res.status(501).json({ error: "not_implemented" });
});

export default router;
