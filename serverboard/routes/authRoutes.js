import { Router } from "express";
import { AuthController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", (req, res, next) => AuthController.register(req, res, next));
router.post("/login", (req, res, next) => AuthController.login(req, res, next));
router.post("/logout", (req, res, next) => AuthController.logout(req, res, next));
router.get("/github", (req, res, next) => {
  if (typeof AuthController?.githubLogin === "function") {
    return AuthController.githubLogin(req, res, next);
  }
  return res.status(501).json({ error: "not_implemented" });
});
router.get("/github/callback", (req, res, next) => {
  if (typeof AuthController?.githubCallback === "function") {
    return AuthController.githubCallback(req, res, next);
  }
  return res.status(501).json({ error: "not_implemented" });
});
router.get("/me", requireAuth, (req, res, next) => AuthController.me(req, res, next));

export default router;
