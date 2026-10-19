export function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.message?.includes("limit reached") ? 403 : 500);
  console.error(`[error] ${err.message || err}`);
  res.status(status).json({
    error: err.name || "server_error",
    message: err.message || "An unexpected error occurred",
  });
}
