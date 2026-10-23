const fs = require("fs");
const { coordinatorStatePath } = require("../../lib/paths");

class CoordinatorStateReader {
  static readState(workspacePath) {
    const files = [coordinatorStatePath(workspacePath), coordinatorStatePath(null)];
    for (const file of files) {
      try {
        const state = JSON.parse(fs.readFileSync(file, "utf8"));
        if (state.port || state.apiPort) return state;
      } catch {
        /* check next fallback */
      }
    }
    return null;
  }

  static readPort(workspacePath) {
    const state = CoordinatorStateReader.readState(workspacePath);
    return state?.port ? Number(state.port) : null;
  }

  static apiPort(workspacePath) {
    if (process.env.LATCH_PORT || process.env.RELAY_PORT) {
      return Number(process.env.LATCH_PORT || process.env.RELAY_PORT);
    }
    const state = CoordinatorStateReader.readState(workspacePath);
    return Number(state?.apiPort) || 3001;
  }
}

module.exports = { CoordinatorStateReader };
