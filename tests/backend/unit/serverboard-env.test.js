import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

describe("serverboard env configuration (serverboard/config/env.js)", () => {
  const originalEnv = process.env;
  let existsSyncSpy;

  beforeEach(() => {
    // Clone process.env to avoid cross-test pollution
    process.env = { ...originalEnv };
    // Prevent tests from loading any local .env file
    existsSyncSpy = vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (typeof p === "string" && p.includes(".env")) {
        return false;
      }
      return false;
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    existsSyncSpy.mockRestore();
    vi.restoreAllMocks();
  });

  async function loadConfig() {
    vi.resetModules();
    const mod = await import("../../../serverboard/config/env.js");
    return mod.config;
  }

  it("loads default configuration values when no environment variables are set", async () => {
    delete process.env.ENV_TYPE;
    delete process.env.NODE_ENV;
    delete process.env.ALLOW_DEV_AUTH;
    delete process.env.PORT;
    delete process.env.SERVERBOARD_PORT;
    delete process.env.CORS_ORIGIN;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.INNGEST_EVENT_KEY;
    delete process.env.INNGEST_SIGNING_KEY;
    delete process.env.RENDER_WEBHOOK_SECRET;

    const config = await loadConfig();

    expect(config.envType).toBe("dev");
    expect(config.isDev).toBe(true);
    expect(config.isProd).toBe(false);
    expect(config.isTest).toBe(false);
    expect(config.allowDevAuth).toBe(false);
    expect(config.port).toBe(4000);
    expect(config.corsOrigins).toEqual([
      "http://localhost:3000",
      "http://localhost:3002",
      "http://localhost:4000",
      "http://127.0.0.1:3002",
    ]);
    expect(config.supabase).toEqual({
      url: undefined,
      serviceRoleKey: null,
      anonKey: null,
      key: null,
    });
    expect(config.inngest).toEqual({
      eventKey: undefined,
      signingKey: undefined,
      isDev: true,
    });
    expect(config.webhookSecret).toBeUndefined();
  });

  describe("environment selection and aliases", () => {
    it.each([
      ["prod", true, false, false],
      ["production", true, false, false],
      ["PRODUCTION", true, false, false],
      ["dev", false, true, false],
      ["development", false, true, false],
      ["DEVELOPMENT", false, true, false],
      ["test", false, false, true],
      ["TEST", false, false, true],
    ])("correctly flags environment for ENV_TYPE=%s", async (envVal, expectedProd, expectedDev, expectedTest) => {
      process.env.ENV_TYPE = envVal;
      if (expectedProd) {
        process.env.INNGEST_SIGNING_KEY = "test-signing-key";
        process.env.SUPABASE_SERVICE_ROLE = "test-role-key";
      }

      const config = await loadConfig();
      expect(config.envType).toBe(envVal.toLowerCase());
      expect(config.isProd).toBe(expectedProd);
      expect(config.isDev).toBe(expectedDev);
      expect(config.isTest).toBe(expectedTest);
    });

    it("falls back to NODE_ENV when ENV_TYPE is unset", async () => {
      delete process.env.ENV_TYPE;
      process.env.NODE_ENV = "production";
      process.env.INNGEST_SIGNING_KEY = "test-signing-key";
      process.env.SUPABASE_SERVICE_ROLE = "test-role-key";

      const config = await loadConfig();
      expect(config.envType).toBe("production");
      expect(config.isProd).toBe(true);
      expect(config.isDev).toBe(false);
    });
  });

  describe("production credential validation", () => {
    beforeEach(() => {
      process.env.ENV_TYPE = "production";
    });

    it("throws when INNGEST_SIGNING_KEY is missing in production", async () => {
      delete process.env.INNGEST_SIGNING_KEY;
      process.env.SUPABASE_SERVICE_ROLE = "test-role-key";

      await expect(loadConfig()).rejects.toThrow(
        "Security Error: INNGEST_SIGNING_KEY is required in production mode"
      );
    });

    it("throws when SUPABASE_SERVICE_ROLE is missing in production", async () => {
      process.env.INNGEST_SIGNING_KEY = "test-signing-key";
      delete process.env.SUPABASE_SERVICE_ROLE;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(loadConfig()).rejects.toThrow(
        "Security Error: SUPABASE_SERVICE_ROLE (service-role key) is required in production mode"
      );
    });

    it("succeeds when both INNGEST_SIGNING_KEY and SUPABASE_SERVICE_ROLE_KEY alias are set in production", async () => {
      process.env.INNGEST_SIGNING_KEY = "test-signing-key";
      delete process.env.SUPABASE_SERVICE_ROLE;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-role-key-alias";

      const config = await loadConfig();
      expect(config.isProd).toBe(true);
      expect(config.supabase.serviceRoleKey).toBe("test-role-key-alias");
    });
  });

  describe("allowDevAuth behavior", () => {
    it("enables allowDevAuth only in dev when ALLOW_DEV_AUTH is '1'", async () => {
      process.env.ENV_TYPE = "dev";
      process.env.ALLOW_DEV_AUTH = "1";

      const config = await loadConfig();
      expect(config.allowDevAuth).toBe(true);
    });

    it("disables allowDevAuth in dev when ALLOW_DEV_AUTH is not '1'", async () => {
      process.env.ENV_TYPE = "dev";
      process.env.ALLOW_DEV_AUTH = "true";

      const config = await loadConfig();
      expect(config.allowDevAuth).toBe(false);
    });

    it("disables allowDevAuth in production even if ALLOW_DEV_AUTH is '1'", async () => {
      process.env.ENV_TYPE = "production";
      process.env.INNGEST_SIGNING_KEY = "test-key";
      process.env.SUPABASE_SERVICE_ROLE = "test-role";
      process.env.ALLOW_DEV_AUTH = "1";

      const config = await loadConfig();
      expect(config.allowDevAuth).toBe(false);
    });

    it("disables allowDevAuth in test mode even if ALLOW_DEV_AUTH is '1'", async () => {
      process.env.ENV_TYPE = "test";
      process.env.ALLOW_DEV_AUTH = "1";

      const config = await loadConfig();
      expect(config.allowDevAuth).toBe(false);
    });
  });

  describe("CORS origin parsing", () => {
    it("parses comma-separated origins and trims surrounding whitespace", async () => {
      process.env.CORS_ORIGIN = " https://app.latch.dev , http://localhost:3000 , http://localhost:8080 ";

      const config = await loadConfig();
      expect(config.corsOrigins).toEqual([
        "https://app.latch.dev",
        "http://localhost:3000",
        "http://localhost:8080",
      ]);
    });
  });

  describe("port configuration and fallbacks", () => {
    it("uses PORT when set", async () => {
      process.env.PORT = "5050";
      process.env.SERVERBOARD_PORT = "6060";

      const config = await loadConfig();
      expect(config.port).toBe(5050);
    });

    it("falls back to SERVERBOARD_PORT when PORT is not set", async () => {
      delete process.env.PORT;
      process.env.SERVERBOARD_PORT = "6060";

      const config = await loadConfig();
      expect(config.port).toBe(6060);
    });
  });

  describe("Supabase configuration and key fallbacks", () => {
    it("prefers SUPABASE_URL over NEXT_PUBLIC_SUPABASE_URL", async () => {
      process.env.SUPABASE_URL = "https://primary.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fallback.supabase.co";

      const config = await loadConfig();
      expect(config.supabase.url).toBe("https://primary.supabase.co");
    });

    it("falls back to NEXT_PUBLIC_SUPABASE_URL when SUPABASE_URL is missing", async () => {
      delete process.env.SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fallback.supabase.co";

      const config = await loadConfig();
      expect(config.supabase.url).toBe("https://fallback.supabase.co");
    });

    it("falls back anonKey to serviceRoleKey when anonKey is not provided", async () => {
      delete process.env.SUPABASE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.SUPABASE_ANON_KEY;
      process.env.SUPABASE_SERVICE_ROLE = "secret-service-role";

      const config = await loadConfig();
      expect(config.supabase.serviceRoleKey).toBe("secret-service-role");
      expect(config.supabase.anonKey).toBe("secret-service-role");
      expect(config.supabase.key).toBe("secret-service-role");
    });

    it("falls back serviceRoleKey to anonKey in non-production when service role key is missing", async () => {
      process.env.ENV_TYPE = "dev";
      delete process.env.SUPABASE_SERVICE_ROLE;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.SUPABASE_ANON_KEY = "anon-key-123";

      const config = await loadConfig();
      expect(config.supabase.anonKey).toBe("anon-key-123");
      expect(config.supabase.serviceRoleKey).toBe("anon-key-123");
      expect(config.supabase.key).toBe("anon-key-123");
    });

    it("resolves NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as anonKey", async () => {
      process.env.ENV_TYPE = "dev";
      delete process.env.SUPABASE_KEY;
      delete process.env.SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-anon-key";

      const config = await loadConfig();
      expect(config.supabase.anonKey).toBe("publishable-anon-key");
    });
  });

  describe("Inngest and Webhook secrets", () => {
    it("maps INNGEST_EVENT_KEY and RENDER_WEBHOOK_SECRET correctly", async () => {
      process.env.INNGEST_EVENT_KEY = "ievt_abc";
      process.env.RENDER_WEBHOOK_SECRET = "whsec_xyz";

      const config = await loadConfig();
      expect(config.inngest.eventKey).toBe("ievt_abc");
      expect(config.webhookSecret).toBe("whsec_xyz");
    });
  });
});

