import { supabaseAdmin, supabaseAuth } from "../config/supabase.js";
import { UserModel } from "../models/User.js";
import { config } from "../config/env.js";

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers?.authorization;
    let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    } else if (!token && req.headers?.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    if (token) {
      const { data, error } = await supabaseAuth.auth.getUser(token);
      if (!error && data?.user) {
        req.user = data.user;
        let profile = await UserModel.findById(data.user.id);
        if (!profile) {
          let candidate = (data.user.user_metadata?.username || `user_${data.user.id.slice(0, 8)}`).toLowerCase().replace(/[^a-z0-9_]/g, "_");
          const existing = await UserModel.findByUsername(candidate);
          if (existing && existing.id !== data.user.id) {
            candidate = `${candidate.slice(0, 20)}_${data.user.id.slice(0, 6)}`;
          }
          const userEmail = data.user.email || `${candidate}@placeholder.internal`;
          const { data: created, error: insertError } = await supabaseAdmin.from("users").insert([{
            id: data.user.id,
            username: candidate,
            email: userEmail,
            name: data.user.user_metadata?.name || candidate,
            project_limit: 3,
          }]).select().maybeSingle();

          if (insertError) {
            console.error("[auth] Profile auto-provisioning failed:", insertError.message);
          }

          profile = created || (await UserModel.findById(data.user.id));
          if (!profile) {
            return res.status(500).json({
              error: "profile_error",
              message: "Failed to initialize user profile: " + (insertError?.message || "database error"),
            });
          }
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
