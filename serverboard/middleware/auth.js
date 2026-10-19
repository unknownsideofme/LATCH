import { supabase } from "../config/supabase.js";
import { UserModel } from "../models/User.js";
import { config } from "../config/env.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        req.user = data.user;
        req.userProfile = await UserModel.findById(data.user.id);
        return next();
      }
    }

    // Explicitly gated local development auth fallback: only if ENV_TYPE=dev and ALLOW_DEV_AUTH=1
    if (config.allowDevAuth) {
      const devUserId = req.headers["x-user-id"];
      if (devUserId) {
        const profile = await UserModel.findById(devUserId);
        if (profile) {
          req.user = profile;
          req.userProfile = profile;
          return next();
        }
      }
    }

    return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
  } catch (err) {
    next(err);
  }
}
