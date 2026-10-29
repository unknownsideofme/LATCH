class SseHub {
  constructor() {
    this.clients = new Set();
    // Heartbeat every 15s to keep proxy and client connections alive (prevents ECONNRESET)
    this._heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (client.res.destroyed || client.res.writableEnded) {
          this.clients.delete(client);
          continue;
        }
        try {
          client.res.write(": ping\n\n");
        } catch {
          this.clients.delete(client);
        }
      }
    }, 15000);
    if (this._heartbeat.unref) this._heartbeat.unref();
  }

  subscribe(res, filter = {}) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const client = { res, filter };
    this.clients.add(client);
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);
    const cleanup = () => {
      this.clients.delete(client);
      try { res.end(); } catch { /* already closed */ }
    };
    res.on("close", cleanup);
    res.on("error", cleanup);
    return client;
  }

  emit(event, payload) {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      if (client.res.destroyed || client.res.writableEnded) {
        this.clients.delete(client);
        continue;
      }
      const { workspaceId } = client.filter;
      if (
        event !== "notice" &&
        workspaceId &&
        payload.workspaceId &&
        payload.workspaceId !== workspaceId
      ) {
        continue;
      }
      try {
        client.res.write(data);
      } catch {
        this.clients.delete(client);
        try { client.res.end(); } catch { /* already closed */ }
      }
    }
  }
}

module.exports = { SseHub };
