import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
let lastAdminQuery = null;

function createQueryMock() {
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  return query;
}

vi.mock("../../../serverboard/config/supabase.js", () => ({
  supabaseAuth: {
    auth: {
      getUser: (...args) => mockGetUser(...args),
    },
  },
  supabaseAdmin: {
    from: vi.fn(() => {
      const q = createQueryMock();
      lastAdminQuery = q;
      return q;
    }),
  },
}));

vi.mock("../../../serverboard/models/User.js", () => ({
  UserModel: {
    findById: vi.fn(),
    findByUsername: vi.fn(),
  },
}));

vi.mock("../../../serverboard/config/env.js", () => ({
  config: {
    allowDevAuth: false,
    isDev: false,
  },
}));

import { requireAuth } from "../../../serverboard/middleware/auth.js";
import { UserModel } from "../../../serverboard/models/User.js";
import { config } from "../../../serverboard/config/env.js";

function makeReq(headers = {}) {
  return { headers };
}

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

describe("requireAuth middleware (serverboard/middleware/auth.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.allowDevAuth = false;
    config.isDev = false;
  });

  describe("Bearer token authentication", () => {
    it("authenticates valid bearer token with existing profile", async () => {
      const mockUser = { id: "usr-1", email: "user@example.com" };
      const mockProfile = { id: "usr-1", username: "user_one" };
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      UserModel.findById.mockResolvedValue(mockProfile);

      const req = makeReq({ authorization: "Bearer valid-jwt-token" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(mockGetUser).toHaveBeenCalledWith("valid-jwt-token");
      expect(UserModel.findById).toHaveBeenCalledWith("usr-1");
      expect(req.user).toBe(mockUser);
      expect(req.userProfile).toBe(mockProfile);
      expect(next).toHaveBeenCalledWith();
    });

    it("auto-provisions profile when token is valid but profile is absent", async () => {
      const mockUser = {
        id: "12345678-user",
        email: "auto@example.com",
        user_metadata: { username: "auto_user", name: "Auto User" },
      };
      const createdProfile = { id: "12345678-user", username: "auto_user", email: "auto@example.com" };

      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      // First findById is null (needs provisioning)
      UserModel.findById.mockResolvedValue(null);
      UserModel.findByUsername.mockResolvedValue(null); // No collision

      const req = makeReq({ authorization: "Bearer token-no-profile" });
      const res = makeRes();
      const next = vi.fn();

      // Mock admin query returning created profile
      const q = createQueryMock();
      q.maybeSingle.mockResolvedValue({ data: createdProfile, error: null });
      const { supabaseAdmin } = await import("../../../serverboard/config/supabase.js");
      supabaseAdmin.from.mockReturnValue(q);

      await requireAuth(req, res, next);

      expect(q.insert).toHaveBeenCalledWith([
        {
          id: "12345678-user",
          username: "auto_user",
          email: "auto@example.com",
          name: "Auto User",
          project_limit: 3,
        },
      ]);
      expect(req.userProfile).toEqual(createdProfile);
      expect(next).toHaveBeenCalled();
    });

    it("resolves username collision during auto-provisioning", async () => {
      const mockUser = {
        id: "abcdef998877",
        email: "collide@example.com",
        user_metadata: { username: "taken_user" },
      };
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      UserModel.findById.mockResolvedValue(null);
      // Collision with different user
      UserModel.findByUsername.mockResolvedValue({ id: "other-user-id", username: "taken_user" });

      const q = createQueryMock();
      q.maybeSingle.mockResolvedValue({ data: { id: "abcdef998877", username: "taken_user_abcdef" }, error: null });
      const { supabaseAdmin } = await import("../../../serverboard/config/supabase.js");
      supabaseAdmin.from.mockReturnValue(q);

      const req = makeReq({ authorization: "Bearer collide-token" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(q.insert).toHaveBeenCalledWith([
        expect.objectContaining({ username: "taken_user_abcdef" }),
      ]);
      expect(next).toHaveBeenCalled();
    });

    it("returns 500 profile_error when auto-provisioning database insert fails", async () => {
      const mockUser = { id: "u-fail", email: "fail@example.com" };
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      UserModel.findById.mockResolvedValue(null);
      UserModel.findByUsername.mockResolvedValue(null);

      const q = createQueryMock();
      q.maybeSingle.mockResolvedValue({ data: null, error: new Error("DB connection timeout") });
      const { supabaseAdmin } = await import("../../../serverboard/config/supabase.js");
      supabaseAdmin.from.mockReturnValue(q);

      const req = makeReq({ authorization: "Bearer token" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(res._status).toBe(500);
      expect(res._body).toEqual({
        error: "profile_error",
        message: expect.stringContaining("Failed to initialize user profile: DB connection timeout"),
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Token validation failure & missing header", () => {
    test.each([
      [{}, "no authorization header"],
      [{ authorization: "" }, "empty authorization header"],
      [{ authorization: "Basic xyz" }, "non-Bearer scheme"],
      [{ authorization: "Bearer " }, "empty Bearer token"],
      [{ authorization: "Bearer" }, "missing token"],
    ])("returns 401 when header is invalid (%s)", async (headers) => {
      const req = makeReq(headers);
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ error: "unauthorized", message: "Authentication required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when Supabase auth.getUser returns error (invalid or expired token)", async () => {
      mockGetUser.mockResolvedValue({ data: null, error: new Error("Token expired") });

      const req = makeReq({ authorization: "Bearer expired-token" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body.error).toBe("unauthorized");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Development auth fallback (x-user-id)", () => {
    it("allows x-user-id header when config.allowDevAuth is true and profile exists", async () => {
      config.allowDevAuth = true;
      const devProfile = { id: "dev-user-id", username: "dev_local" };
      UserModel.findById.mockResolvedValue(devProfile);

      const req = makeReq({ "x-user-id": "dev-user-id" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(UserModel.findById).toHaveBeenCalledWith("dev-user-id");
      expect(req.user).toBe(devProfile);
      expect(req.userProfile).toBe(devProfile);
      expect(next).toHaveBeenCalled();
    });

    it("returns 401 when x-user-id profile is not found in database", async () => {
      config.allowDevAuth = true;
      UserModel.findById.mockResolvedValue(null);

      const req = makeReq({ "x-user-id": "unknown-dev-id" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("ignores x-user-id header when config.allowDevAuth is false (e.g. in production)", async () => {
      config.allowDevAuth = false;

      const req = makeReq({ "x-user-id": "dev-user-id" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(UserModel.findById).not.toHaveBeenCalled();
      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Unexpected errors", () => {
    it("passes unexpected runtime exceptions to next(err)", async () => {
      const unexpected = new Error("Supabase internal fault");
      mockGetUser.mockRejectedValue(unexpected);

      const req = makeReq({ authorization: "Bearer token" });
      const res = makeRes();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(unexpected);
    });
  });
});

