"use strict";

require("./config/env");

const express = require("express");
const cors = require("cors");
const { UI_ORIGIN } = require("./config/constants");
const { createHookLogger } = require("./middleware/hookLogger");
const { registerRoutes } = require("./routes");

function createApp(services) {
  const app = express();

  app.use(
    cors({
      origin: [
        UI_ORIGIN,
        "http://127.0.0.1:3002",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        /\.ngrok(-free)?\.app$/,
        /\.ngrok\.io$/,
      ],
      credentials: true,
    })
  );

  // Large body parser for peer chat history payloads
  app.use("/api/room/history", express.json({ limit: "32mb" }));
  app.use(express.json({ limit: "2mb" }));

  // Hook request logger
  app.use(createHookLogger());

  // Mount all modular routes
  registerRoutes(app, services);

  return app;
}

module.exports = {
  createApp,
};
