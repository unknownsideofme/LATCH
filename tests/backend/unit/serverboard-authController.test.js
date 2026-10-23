import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../serverboard/models/User.js", () => ({
  UserModel: {
    register: vi.fn(),
    authenticate: vi.fn(),
    findById: vi.fn(),
    findByUsername: vi.fn(),
  },
}));

vi.mock("../../../serverboard/config/supabase.js", () => ({
  supabaseAuth: {
    auth: {
      signInWithOAuth: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    },
  },
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn() })) })),
    })),
  },
}));

import { AuthController, githubTokenCache } from "../../../serverboard/controllers/authController.js";
import { UserModel } from "../../../serverboard/models/User.js";
import { supabaseAuth } from "../../../serverboard/config/supabase.js";

function makeRes() {
  const res = { _status: 200, _body: null, _redirectUrl: null, _cookies: {}, _clearedCookies: [] };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  res.redirect = (url) => {
    res._redirectUrl = url;
    return res;
  };
  res.cookie = (name, val, options) => {
    res._cookies[name] = { val, options };
    return res;
  };
  res.clearCookie = (name, options) => {
    res._clearedCookies.push({ name, options });
    delete res._cookies[name];
    return res;
  };
  return res;
}

describe("AuthController (serverboard/controllers/authController.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register()", () => {
    it.each([
      [{ password: "p", username: "u" }, "missing email"],
      [{ email: "e", username: "u" }, "missing password"],
      [{ email: "e", password: "p" }, "missing username"],
      [{}, "empty body"],
    ])("returns 400 validation error when required field is missing (%s)", async (body) => {
      const req = { body };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.register(req, res, next);

      expect(res._status).toBe(400);
      expect(res._body).toEqual({
        error: "validation_error",
        message: "email, password, and username required",
      });
      expect(UserModel.register).not.toHaveBeenCalled();
    });

    it("registers user and returns 201 with session and profile, ignoring client projectLimit", async () => {
      const registerResult = {
        user: { id: "usr-1", username: "alice", project_limit: 3 },
        session: { access_token: "tok-123" },
      };
      UserModel.register.mockResolvedValue(registerResult);

      const req = {
        body: {
          email: "alice@example.com",
          password: "password123",
          username: "alice",
          name: "Alice",
          projectLimit: 999, // Should be ignored to prevent quota inflation
        },
      };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.register(req, res, next);

      expect(UserModel.register).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "password123",
        username: "alice",
        name: "Alice",
      });
      expect(res._status).toBe(201);
      expect(res._cookies.token).toBeDefined();
      expect(res._cookies.token.val).toBe("tok-123");
      expect(res._cookies.token.options.httpOnly).toBe(true);
      expect(res._body).toEqual({
        message: "Registered successfully",
        ...registerResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("passes registration errors to error middleware next(err)", async () => {
      const err = new Error("Username already taken");
      UserModel.register.mockRejectedValue(err);

      const req = {
        body: {
          email: "alice@example.com",
          password: "password123",
          username: "alice",
        },
      };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe("login()", () => {
    it.each([
      [{ email: "alice@example.com" }, "missing password"],
      [{ password: "password123" }, "missing email"],
      [{}, "empty body"],
    ])("returns 400 validation error when credentials are incomplete (%s)", async (body) => {
      const req = { body };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.login(req, res, next);

      expect(res._status).toBe(400);
      expect(res._body).toEqual({
        error: "validation_error",
        message: "email and password required",
      });
      expect(UserModel.authenticate).not.toHaveBeenCalled();
    });

    it("logs in successfully and returns 200 with result", async () => {
      const loginResult = {
        user: { id: "usr-1", username: "alice" },
        session: { access_token: "jwt-abc" },
      };
      UserModel.authenticate.mockResolvedValue(loginResult);

      const req = {
        body: {
          email: "alice@example.com",
          password: "password123",
        },
      };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.login(req, res, next);

      expect(UserModel.authenticate).toHaveBeenCalledWith("alice@example.com", "password123");
      expect(res._status).toBe(200);
      expect(res._cookies.token).toBeDefined();
      expect(res._cookies.token.val).toBe("jwt-abc");
      expect(res._cookies.token.options.httpOnly).toBe(true);
      expect(res._body).toEqual({
        message: "Logged in successfully",
        ...loginResult,
      });
    });

    it("returns 401 invalid_credentials when login fails", async () => {
      UserModel.authenticate.mockRejectedValue(new Error("Invalid login credentials"));

      const req = {
        body: {
          email: "alice@example.com",
          password: "wrong",
        },
      };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.login(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({
        error: "invalid_credentials",
        message: "Invalid email or password",
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("me()", () => {
    it("returns req.userProfile when available", async () => {
      const req = {
        userProfile: { id: "u-1", username: "profile_user" },
        user: { id: "u-1", email: "auth_user@example.com" },
      };
      const res = makeRes();

      await AuthController.me(req, res);

      expect(res._body).toEqual({ user: req.userProfile });
    });

    it("falls back to req.user when userProfile is undefined", async () => {
      const req = {
        user: { id: "u-2", email: "only_auth@example.com" },
      };
      const res = makeRes();

      await AuthController.me(req, res);

      expect(res._body).toEqual({ user: req.user });
    });

    it("returns undefined user if neither is set", async () => {
      const req = {};
      const res = makeRes();

      await AuthController.me(req, res);

      expect(res._body).toEqual({ user: undefined });
    });
  });

  describe("logout()", () => {
    it("clears token and refresh_token cookies and returns 200", async () => {
      const req = {};
      const res = makeRes();

      await AuthController.logout(req, res);

      expect(res._clearedCookies.some((c) => c.name === "token")).toBe(true);
      expect(res._clearedCookies.some((c) => c.name === "refresh_token")).toBe(true);
      expect(res._body).toEqual({ message: "Logged out successfully" });
    });
  });

  describe("githubLogin()", () => {
    it("sets oauth_state cookie and redirects to OAuth URL on standard browser request", async () => {
      supabaseAuth.auth.signInWithOAuth.mockResolvedValueOnce({
        data: { url: "https://github.com/login/oauth/authorize?test=1" },
        error: null,
      });

      const req = { headers: {} };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubLogin(req, res, next);

      expect(res._cookies.oauth_state).toBeDefined();
      expect(res._cookies.oauth_state.options.httpOnly).toBe(true);
      expect(typeof res._cookies.oauth_state.val).toBe("string");
      expect(res._redirectUrl).toBe("https://github.com/login/oauth/authorize?test=1");
    });

    it("returns JSON when format=json query is provided", async () => {
      supabaseAuth.auth.signInWithOAuth.mockResolvedValueOnce({
        data: { url: "https://github.com/login/oauth/authorize?test=2" },
        error: null,
      });

      const req = { headers: {}, query: { format: "json" } };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubLogin(req, res, next);

      expect(res._body).toEqual({
        url: "https://github.com/login/oauth/authorize?test=2",
        state: res._cookies.oauth_state.val,
      });
    });
  });

  describe("githubCallback()", () => {
    it("validates CSRF state, clears state cookie, sets session cookies, and redirects without tokens in URL", async () => {
      const validState = "safe-csrf-state-abc";

      supabaseAuth.auth.exchangeCodeForSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            provider_token: "mock-gh-provider-token",
            expires_in: 3600,
          },
          user: {
            id: "u-gh-123",
            email: "ghuser@example.com",
            user_metadata: { user_name: "ghuser" },
          },
        },
        error: null,
      });

      UserModel.findById.mockResolvedValueOnce({
        id: "u-gh-123",
        username: "ghuser",
      });

      const req = {
        query: { code: "oauth-auth-code-123", state: validState },
        cookies: { oauth_state: validState },
      };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubCallback(req, res, next);

      // Verify oauth_state and oauth_verifier cookies were cleared
      expect(res._clearedCookies.some((c) => c.name === "oauth_state")).toBe(true);
      expect(res._clearedCookies.some((c) => c.name === "oauth_verifier")).toBe(true);

      // Verify session cookies set
      expect(res._cookies.token).toBeDefined();
      expect(res._cookies.token.val).toBe("mock-access-token");
      expect(res._cookies.token.options.httpOnly).toBe(true);

      expect(res._cookies.refresh_token).toBeDefined();
      expect(res._cookies.refresh_token.val).toBe("mock-refresh-token");
      expect(res._cookies.refresh_token.options.httpOnly).toBe(true);

      // Verify provider_token is cached on server and NEVER in cookie or URL
      expect(githubTokenCache.get("u-gh-123")).toBe("mock-gh-provider-token");
      expect(res._cookies.provider_token).toBeUndefined();

      // Verify redirect target has NO token parameters in URL query or hash
      expect(res._redirectUrl).toMatch(/\/dashboard$/);
      expect(res._redirectUrl).not.toContain("token=");
      expect(res._redirectUrl).not.toContain("provider_token=");
    });

    it("rejects callback with 403 invalid_state when state parameter is missing or mismatched", async () => {
      const req = {
        query: { code: "oauth-auth-code-123", state: "tampered-state" },
        cookies: { oauth_state: "original-state" },
      };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubCallback(req, res, next);

      expect(res._status).toBe(403);
      expect(res._body.error).toBe("invalid_state");
    });

    it("redirects with error parameter when OAuth error occurs", async () => {
      const req = { query: { error: "access_denied", error_description: "User cancelled" } };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubCallback(req, res, next);

      expect(res._redirectUrl).toContain("error=access_denied");
    });

    it("redirects browser to /login?error=missing_code when code is missing on HTML request", async () => {
      const req = { headers: { accept: "text/html,application/xhtml+xml" }, query: {} };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubCallback(req, res, next);

      expect(res._redirectUrl).toMatch(/\/login\?error=missing_code$/);
    });

    it("returns 400 missing_code when code is missing on API request", async () => {
      const req = { headers: { accept: "application/json" }, query: {} };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubCallback(req, res, next);

      expect(res._status).toBe(400);
      expect(res._body.error).toBe("missing_code");
    });

    it("restores PKCE verifier from oauth_verifier cookie and passes flowId to exchangeCodeForSession", async () => {
      const mockStorage = new Map();
      supabaseAuth.auth.storageKey = "sb-test-token";
      supabaseAuth.auth.storage = {
        getItem: vi.fn((k) => mockStorage.get(k)),
        setItem: vi.fn((k, v) => mockStorage.set(k, v)),
      };
      supabaseAuth.auth.exchangeCodeForSession.mockResolvedValueOnce({
        data: {
          session: { access_token: "tok" },
          user: { id: "u-pkce", user_metadata: {} },
        },
        error: null,
      });
      UserModel.findById.mockResolvedValueOnce({ id: "u-pkce" });

      const req = {
        query: { code: "code-pkce-123", state: "st-1" },
        cookies: {
          oauth_state: "st-1",
          oauth_verifier: JSON.stringify({ verifier: "raw-verifier-abc", flowId: "flow-999" }),
        },
      };
      const res = makeRes();
      const next = vi.fn();

      await AuthController.githubCallback(req, res, next);

      expect(mockStorage.get("sb-test-token-flow-flow-999-code-verifier")).toBe("raw-verifier-abc");
      expect(mockStorage.get("sb-test-token-code-verifier")).toBe("raw-verifier-abc");
      expect(supabaseAuth.auth.exchangeCodeForSession).toHaveBeenCalledWith(
        "code-pkce-123",
        { flowId: "flow-999" }
      );
    });
  });
});

