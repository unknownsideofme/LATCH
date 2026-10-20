import { UserModel } from "../models/User.js";

export const AuthController = {
  async register(req, res, next) {
    try {
      const { email, password, username, name } = req.body;
      if (!email || !password || !username) {
        return res.status(400).json({ error: "validation_error", message: "email, password, and username required" });
      }
      // Note: projectLimit is deliberately omitted from req.body to prevent quota inflation
      const result = await UserModel.register({ email, password, username, name });
      res.status(201).json({ message: "Registered successfully", ...result });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "validation_error", message: "email and password required" });
      }
      const result = await UserModel.authenticate(email, password);
      res.json({ message: "Logged in successfully", ...result });
    } catch (err) {
      console.error("[auth] Login failed:", err.message);
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
    }
  },

  async me(req, res) {
    res.json({ user: req.userProfile || req.user });
  },
};
