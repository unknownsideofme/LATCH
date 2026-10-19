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
        let profile = await UserModel.findById(data.user.id);
        if (!profile) {
          const username = data.user.user_metadata?.username || `user_${data.user.id.slice(0, 8)}`;
          const { data: created } = await supabase.from("users").insert([{
            id: data.user.id,
            username,
            email: data.user.email,
            name: data.user.user_metadata?.name || username,
            project_limit: 3,
          }]).select().maybeSingle();
          profile = created;
        }
        req.userProfile = profile;
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
