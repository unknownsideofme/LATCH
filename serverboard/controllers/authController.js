import crypto from "crypto";
import { UserModel } from "../models/User.js";
import { supabaseAuth, supabaseAdmin } from "../config/supabase.js";
import { config } from "../config/env.js";

// In-memory cache for GitHub provider tokens mapped by userId
export const githubTokenCache = new Map();

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

  /**
   * Start GitHub OAuth with user, email, and repository scopes and the configured
   * server callback URL. Return `{ url }` for XHR, an Accept header containing
   * `application/json`, or `format=json`; otherwise redirect to the authorization URL.
   * Supabase OAuth errors return HTTP 500 with `oauth_init_failed`;
   * thrown errors are forwarded to `next`.
   */
  async githubLogin(req, res, next) {
    try {
      const state = crypto.randomBytes(16).toString("hex");
      const isSecure = config.isProd || process.env.NODE_ENV === "production";

      if (typeof res.cookie === "function") {
        res.cookie("oauth_state", state, {
          httpOnly: true,
          secure: isSecure,
          sameSite: "lax",
          maxAge: 10 * 60 * 1000, // 10 minutes
          path: "/",
        });
      }

      const redirectUri = `${config.serverUrl}/api/v1/auth/github/callback`;
      const { data, error } = await supabaseAuth.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: redirectUri,
          scopes: "read:user user:email repo",
          queryParams: { state },
        },
      });

      if (error) {
        return res.status(500).json({ error: "oauth_init_failed", message: error.message });
      }

      // If requested via JSON, return URL directly
      if (req.xhr || req.headers?.accept?.includes("application/json") || req.query?.format === "json") {
        return res.json({ url: data.url, state });
      }

      // Otherwise redirect browser to GitHub OAuth authorization URL
      res.redirect(data.url);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Exchange the query's OAuth code for a session, attempt to create a missing
   * user profile with a project limit of 10, and cache any GitHub token by user ID
   * in memory. Redirect to the configured frontend's `/dashboard` with the access
   * token in `token` and available `refresh_token` and `provider_token` query values.
   * Provider errors redirect to `/login` with that error; a missing code returns
   * HTTP 400 with `missing_code`. Failed or incomplete exchanges redirect to
   * `/login?error=auth_failed`. Returned profile insertion errors do not block the
   * dashboard redirect; thrown errors are forwarded to `next`.
   */
  async githubCallback(req, res, next) {
    try {
      const { code, state, error: oauthError, error_description } = req.query || {};

      if (oauthError) {
        console.warn("[auth] GitHub OAuth error:", oauthError, error_description);
        return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(String(oauthError))}`);
      }

      if (!code) {
        return res.status(400).json({ error: "missing_code", message: "OAuth code is required" });
      }

      // Validate CSRF state against HttpOnly cookie
      let savedState = req.cookies?.oauth_state;
      if (!savedState && req.headers?.cookie) {
        const match = req.headers.cookie.match(/(?:^|;\s*)oauth_state=([^;]+)/);
        if (match) savedState = decodeURIComponent(match[1]);
      }

      if (!state || !savedState || state !== savedState) {
        return res.status(403).json({
          error: "invalid_state",
          message: "OAuth state mismatch or CSRF token missing",
        });
      }

      if (typeof res.clearCookie === "function") {
        res.clearCookie("oauth_state", { path: "/" });
      }

      const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(String(code));

      if (error || !data?.session || !data?.user) {
        console.error("[auth] Failed to exchange code for session:", error?.message);
        return res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
      }

      const user = data.user;
      const metadata = user.user_metadata || {};
      const candidateUsername = (metadata.user_name || metadata.preferred_username || user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_");

      let profile = await UserModel.findById(user.id);
      if (!profile) {
        let username = candidateUsername;
        const existing = await UserModel.findByUsername(username);
        if (existing && existing.id !== user.id) {
          username = `${username.slice(0, 20)}_${user.id.slice(0, 6)}`;
        }

        const { data: created, error: insertError } = await supabaseAdmin.from("users").insert([{
          id: user.id,
          username,
          name: metadata.full_name || metadata.name || username,
          email: user.email || `${username}@placeholder.internal`,
          project_limit: 10,
        }]).select().maybeSingle();

        if (insertError) {
          console.error("[auth] Failed to insert profile for OAuth user:", insertError.message);
        }
        profile = created || (await UserModel.findById(user.id));
      }

      // Cache GitHub provider_token in-memory for repo fetching
      if (data.session.provider_token) {
        githubTokenCache.set(user.id, data.session.provider_token);
      }

      // Establish session via HttpOnly, Secure, SameSite cookies to avoid leaking tokens in redirect URL
      const isSecure = config.isProd || process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
      };

      if (typeof res.cookie === "function") {
        res.cookie("token", data.session.access_token, {
          ...cookieOptions,
          maxAge: (data.session.expires_in || 3600) * 1000,
        });
        if (data.session.refresh_token) {
          res.cookie("refresh_token", data.session.refresh_token, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });
        }
      }

      // Redirect directly to dashboard without tokens in query parameters or hash
      res.redirect(`${config.frontendUrl}/dashboard`);
    } catch (err) {
      next(err);
    }
  },
};
