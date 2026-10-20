import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../serverboard/config/env.js", () => ({
  config: {
    isDev: false,
    isProd: true,
  },
}));

import { errorHandler } from "../../../serverboard/middleware/errorHandler.js";
import { config } from "../../../serverboard/config/env.js";

function makeRes() {
  const res = { _status: null, _body: null };
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

describe("errorHandler middleware (serverboard/middleware/errorHandler.js)", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    config.isDev = false;
    config.isProd = true;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Client error handling (4xx)", () => {
    it("preserves explicit 4xx status codes and error message", () => {
      const err = new Error("Invalid payload format");
      err.status = 422;

      const res = makeRes();
      errorHandler(err, {}, res, vi.fn());

      expect(res._status).toBe(422);
      expect(res._body).toEqual({
        error: "Error",
        message: "Invalid payload format",
      });
    });

    it("defaults error field to 'client_error' when err.name is not set or custom", () => {
      const err = { status: 400, message: "Bad input" };

      const res = makeRes();
      errorHandler(err, {}, res, vi.fn());

      expect(res._status).toBe(400);
      expect(res._body).toEqual({
        error: "client_error",
        message: "Bad input",
      });
    });

    test.each([
      ["Project limit reached (3/3)", "limit reached"],
      ["Username 'alice' is already taken", "already taken"],
      ["email, password, and username required", "required"],
    ])("maps recognized message '%s' (%s) to status 400", (msg) => {
      const err = new Error(msg);
      delete err.status;

      const res = makeRes();
      errorHandler(err, {}, res, vi.fn());

      expect(res._status).toBe(400);
      expect(res._body.message).toBe(msg);
    });

    it("maps Postgres unique violation (code 23505) to status 400", () => {
      const err = new Error("Key (email)=(user@test.com) already exists");
      err.code = "23505";

      const res = makeRes();
      errorHandler(err, {}, res, vi.fn());

      expect(res._status).toBe(400);
      expect(res._body.message).toBe("Key (email)=(user@test.com) already exists");
    });
  });

  describe("Server error handling (500)", () => {
    it("sanitizes error message in production mode (config.isDev=false)", () => {
      const err = new Error("FATAL: connection to server on socket failed");

      const res = makeRes();
      errorHandler(err, {}, res, vi.fn());

      expect(res._status).toBe(500);
      expect(res._body).toEqual({
        error: "Error",
        message: "Internal server error",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("500: FATAL: connection to server")
      );
    });

    it("defaults error field to 'server_error' when err has no name", () => {
      const err = { message: "Internal crash" };

      const res = makeRes();
      errorHandler(err, {}, res, vi.fn());

      expect(res._status).toBe(500);
      expect(res._body).toEqual({
        error: "server_error",
        message: "Internal server error",
      });
    });

    it("preserves actual error message in development mode (config.isDev=true)", () => {
      config.isDev = true;
      config.isProd = false;

      const err = new Error("Database deadlock occurred at line 42");

      const res = makeRes();
      errorHandler(err, {}, res, vi.fn());

      expect(res._status).toBe(500);
      expect(res._body).toEqual({
        error: "Error",
        message: "Database deadlock occurred at line 42",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith("[error-handler]", err);
    });
  });
});

