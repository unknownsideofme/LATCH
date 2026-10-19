import { config } from "../config/env.js";

export function errorHandler(err, _req, res, _next) {
  const isClientError =
    err.status && err.status >= 400 && err.status < 500 ||
    err.message?.includes("limit reached") ||
    err.message?.includes("already taken") ||
    err.message?.includes("required") ||
    err.code === "23505";

  const status = isClientError ? (err.status || 400) : 500;

  if (config.isDev) {
    console.error("[error-handler]", err);
  } else {
    console.error(`[error-handler] ${status}: ${err.message}`);
  }

  // In production, do not leak internal 500 stack traces or database errors
  const message = isClientError || config.isDev ? err.message : "Internal server error";

  res.status(status).json({
    error: err.name || (isClientError ? "client_error" : "server_error"),
    message,
  });
}
