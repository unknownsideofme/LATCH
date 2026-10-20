import { beforeEach, describe, expect, it, vi } from "vitest";

// Fluent Supabase mock builder
let dbResults = {};
let lastAdminQuery = null;

function createQueryMock() {
  const query = {
    _table: "",
    select: vi.fn(function () {
      return query;
    }),
    eq: vi.fn(function () {
      return query;
    }),
    insert: vi.fn(function () {
      return query;
    }),
    maybeSingle: vi.fn(async function () {
      const res = dbResults[query._table]?.maybeSingle ?? { data: null, error: null };
      if (res instanceof Error) throw res;
      return res;
    }),
    single: vi.fn(async function () {
      const res = dbResults[query._table]?.single ?? { data: null, error: null };
      if (res instanceof Error) throw res;
      return res;
    }),
  };
  return query;
}

const mockCreateUser = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock("../../../serverboard/config/supabase.js", () => {
  return {
    supabaseAdmin: {
      from: vi.fn((table) => {
        const q = createQueryMock();
        q._table = table;
        lastAdminQuery = q;
        return q;
      }),
      auth: {
        admin: {
          createUser: (...args) => mockCreateUser(...args),
        },
      },
    },
    supabaseAuth: {
      auth: {
        signInWithPassword: (...args) => mockSignInWithPassword(...args),
      },
    },
  };
});

import { UserModel } from "../../../serverboard/models/User.js";
import { supabaseAdmin, supabaseAuth } from "../../../serverboard/config/supabase.js";

describe("UserModel (serverboard/models/User.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults = {};
    lastAdminQuery = null;
  });

  describe("findById() and findByUsername()", () => {
    it("findById queries users table by id", async () => {
      const mockUser = { id: "usr-1", username: "alice", email: "alice@example.com" };
      dbResults.users = { maybeSingle: { data: mockUser, error: null } };

      const user = await UserModel.findById("usr-1");

      expect(supabaseAdmin.from).toHaveBeenCalledWith("users");
      expect(lastAdminQuery.select).toHaveBeenCalledWith("*");
      expect(lastAdminQuery.eq).toHaveBeenCalledWith("id", "usr-1");
      expect(user).toEqual(mockUser);
    });

    it("findByUsername normalizes username to lowercase and trims whitespace", async () => {
      const mockUser = { id: "usr-2", username: "bob_dev" };
      dbResults.users = { maybeSingle: { data: mockUser, error: null } };

      const user = await UserModel.findByUsername("  BOB_DEV  ");

      expect(lastAdminQuery.eq).toHaveBeenCalledWith("username", "bob_dev");
      expect(user).toEqual(mockUser);
    });

    it("findWithProjects queries users with joined projects", async () => {
      const mockUserWithProjects = { id: "usr-3", username: "carol", projects: [{ id: "p-1" }] };
      dbResults.users = { maybeSingle: { data: mockUserWithProjects, error: null } };

      const user = await UserModel.findWithProjects("usr-3");

      expect(lastAdminQuery.select).toHaveBeenCalledWith("*, projects(*)");
      expect(lastAdminQuery.eq).toHaveBeenCalledWith("id", "usr-3");
      expect(user).toEqual(mockUserWithProjects);
    });
  });

  describe("register()", () => {
    const validParams = {
      email: "new@example.com",
      password: "SecretPassword123!",
      username: "valid_user",
      name: "Valid User",
    };

    it.each([
      ["ab", "too short (<3 chars)"],
      ["a".repeat(31), "too long (>30 chars)"],
      ["user-name", "contains hyphens (not allowed)"],
      ["user name", "contains spaces"],
      ["user@name", "contains special characters"],
      ["", "empty username"],
    ])("rejects invalid username '%s' (%s)", async (badUsername) => {
      await expect(
        UserModel.register({
          ...validParams,
          username: badUsername,
        })
      ).rejects.toThrow("Username must be between 3 and 30 alphanumeric characters or underscores");
    });

    it("rejects registration when username is already taken", async () => {
      dbResults.users = { maybeSingle: { data: { id: "existing-user", username: "valid_user" }, error: null } };

      await expect(UserModel.register(validParams)).rejects.toThrow(
        "Username 'valid_user' is already taken"
      );
    });

    it("throws error when Supabase auth.admin.createUser fails", async () => {
      dbResults.users = { maybeSingle: { data: null, error: null } };
      const authError = new Error("Auth service unavailable");
      mockCreateUser.mockResolvedValue({ data: null, error: authError });

      await expect(UserModel.register(validParams)).rejects.toThrow("Auth service unavailable");
    });

    it("throws database error when profile insertion fails (revealing partial registration state)", async () => {
      dbResults.users = {
        maybeSingle: { data: null, error: null },
        single: { data: null, error: new Error("duplicate email in users table") },
      };
      mockCreateUser.mockResolvedValue({
        data: { user: { id: "auth-user-99", email: "new@example.com" } },
        error: null,
      });

      await expect(UserModel.register(validParams)).rejects.toThrow("duplicate email in users table");

      // Verify that createUser was indeed called, leaving an orphaned auth user
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "SecretPassword123!",
        email_confirm: true,
        user_metadata: { username: "valid_user", name: "Valid User" },
      });
    });

    it("successfully creates auth user, inserts profile, and logs in user", async () => {
      dbResults.users = {
        maybeSingle: { data: null, error: null }, // for findByUsername uniqueness check
        single: {
          data: { id: "auth-1", username: "valid_user", email: "new@example.com", project_limit: 3 },
          error: null,
        },
      };
      mockCreateUser.mockResolvedValue({
        data: { user: { id: "auth-1", email: "new@example.com" } },
        error: null,
      });

      // Mock authenticate call
      const authSpy = vi.spyOn(UserModel, "authenticate").mockResolvedValue({
        user: { id: "auth-1", username: "valid_user" },
        session: { access_token: "jwt-token-123" },
      });

      const res = await UserModel.register(validParams);

      expect(res.user.username).toBe("valid_user");
      expect(res.session.access_token).toBe("jwt-token-123");
      authSpy.mockRestore();
    });
  });

  describe("authenticate()", () => {
    it("throws when credentials authentication fails in Supabase Auth", async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: new Error("Invalid login credentials"),
      });

      await expect(UserModel.authenticate("alice@example.com", "wrong-password")).rejects.toThrow(
        "Invalid login credentials"
      );
    });

    it("returns user profile and session when profile exists", async () => {
      const mockSession = { access_token: "jwt-xyz" };
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: "usr-existing", email: "alice@example.com" },
          session: mockSession,
        },
        error: null,
      });

      dbResults.users = {
        maybeSingle: { data: { id: "usr-existing", username: "alice", email: "alice@example.com" } },
      };

      const result = await UserModel.authenticate("alice@example.com", "password");

      expect(result.user.username).toBe("alice");
      expect(result.session).toEqual(mockSession);
    });

    it("auto-provisions missing profile on successful authentication", async () => {
      const mockSession = { access_token: "jwt-new" };
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: "12345678-abcd",
            email: "bob@example.com",
            user_metadata: { username: "bob_dev", name: "Bob Dev" },
          },
          session: mockSession,
        },
        error: null,
      });

      // First findById returns null (profile missing)
      // findByUsername returns null (no collision)
      // insert().maybeSingle returns created profile
      let callCount = 0;
      const originalFrom = supabaseAdmin.from;
      supabaseAdmin.from = vi.fn((table) => {
        const q = createQueryMock();
        q._table = table;
        q.maybeSingle = vi.fn(async () => {
          callCount++;
          if (callCount === 1) return { data: null }; // findById
          if (callCount === 2) return { data: null }; // findByUsername
          return { data: { id: "12345678-abcd", username: "bob_dev", email: "bob@example.com" } }; // insert
        });
        return q;
      });

      const result = await UserModel.authenticate("bob@example.com", "password");

      expect(result.user.username).toBe("bob_dev");
      expect(result.session).toEqual(mockSession);
      supabaseAdmin.from = originalFrom;
    });

    it("handles username collision during auto-provisioning by appending user id slice", async () => {
      const mockSession = { access_token: "jwt-col" };
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: "abcdef1234567890",
            email: "clash@example.com",
            user_metadata: { username: "existing_user" },
          },
          session: mockSession,
        },
        error: null,
      });

      let callCount = 0;
      let insertedRow = null;
      const originalFrom = supabaseAdmin.from;
      supabaseAdmin.from = vi.fn((table) => {
        const q = createQueryMock();
        q._table = table;
        q.insert = vi.fn((rows) => {
          insertedRow = rows[0];
          return q;
        });
        q.maybeSingle = vi.fn(async () => {
          callCount++;
          if (callCount === 1) return { data: null }; // findById -> missing
          if (callCount === 2) return { data: { id: "different-user-id", username: "existing_user" } }; // collision!
          return { data: insertedRow };
        });
        return q;
      });

      const result = await UserModel.authenticate("clash@example.com", "password");

      // Collided username candidate should be modified: candidate.slice(0, 20) + "_" + id.slice(0, 6)
      expect(insertedRow.username).toBe("existing_user_abcdef");
      expect(result.user.username).toBe("existing_user_abcdef");
      supabaseAdmin.from = originalFrom;
    });
  });
});

