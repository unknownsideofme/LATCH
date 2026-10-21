import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../serverboard/models/User.js", () => ({
  UserModel: {
    register: vi.fn(),
    authenticate: vi.fn(),
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

import { AuthController } from "../../../serverboard/controllers/authController.js";
import { UserModel } from "../../../serverboard/models/User.js";

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
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
});

