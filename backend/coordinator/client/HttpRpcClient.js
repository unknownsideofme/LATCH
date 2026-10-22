const http = require("http");

class HttpRpcClient {
  static postJson(port, pathname, body, timeoutMs) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body || {});
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(raw || "{}") });
            } catch (err) {
              reject(err);
            }
          });
        }
      );
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
      req.write(data);
      req.end();
    });
  }

  static getJson(port, pathname, timeoutMs) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: pathname,
          method: "GET",
          timeout: timeoutMs,
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(raw || "{}"));
            } catch (err) {
              reject(err);
            }
          });
        }
      );
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject);
      req.end();
    });
  }

  static async postRemote(url, pathname, body, timeoutMs, token) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}${pathname}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "relay",
          ...(token ? { "x-latch-room-token": token, "x-relay-room-token": token } : {}),
        },
        body: JSON.stringify(body || {}),
        signal: ctrl.signal,
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { HttpRpcClient };
