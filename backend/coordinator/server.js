#!/usr/bin/env node
const {
  createCoordinator,
  listen,
  writeState,
  startStandalone,
} = require("./server/CoordinatorServerApp");

if (require.main === module) {
  startStandalone().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createCoordinator, listen, writeState, startStandalone };
