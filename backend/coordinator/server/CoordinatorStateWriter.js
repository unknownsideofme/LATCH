const fs = require("fs");
const path = require("path");
const { coordinatorStatePath } = require("../../lib/paths");

class CoordinatorStateWriter {
  static writeState(workspacePath, port, extra = {}) {
    const state = { port, ...extra, startedAt: new Date().toISOString(), pid: process.pid };
    const targets = [coordinatorStatePath(null)];
    if (workspacePath) targets.push(coordinatorStatePath(workspacePath));
    for (const file of targets) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 2));
    }
  }
}

module.exports = { CoordinatorStateWriter };
