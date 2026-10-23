class PortListener {
  static async listen(server, preferredPort) {
    const tryPort = async (port) =>
      new Promise((resolve, reject) => {
        const onError = (err) => {
          server.off("listening", onListen);
          reject(err);
        };
        const onListen = () => {
          server.off("error", onError);
          resolve(server.address().port);
        };
        server.once("error", onError);
        server.once("listening", onListen);
        server.listen(port, "127.0.0.1");
      });

    try {
      return await tryPort(preferredPort || 0);
    } catch (err) {
      if (err.code === "EADDRINUSE") return tryPort(0);
      throw err;
    }
  }
}

module.exports = { PortListener };
