const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

function homeLatchDir() {
  const latchDir = path.join(os.homedir(), ".latch");
  const relayDir = path.join(os.homedir(), ".relay");
  const dir = fs.existsSync(latchDir) ? latchDir : (fs.existsSync(relayDir) ? relayDir : latchDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function homeRelayDir() {
  return homeLatchDir();
}

function tryMkdir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    // Missing drive (D:\ on a machine that only has C:), unplugged disk, or a
    // host path from another OS. Callers fall back to ~/.relay instead of
    // taking down relay serve.
    return false;
  }
}

function dataDir() {
  const dir = path.join(homeLatchDir(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function registryPath() {
  return path.join(dataDir(), "registry.json");
}

function sessionPath() {
  return path.join(dataDir(), "session.json");
}

function nativeWorkspaceRoot(workspacePath) {
  if (!workspacePath) return workspacePath;
  let trimmed = String(workspacePath).trim().replace(/^file:\/+/i, "/");
  const drive = trimmed.match(/^\/?([a-zA-Z]):([\\/].*)$/);
  if (drive) trimmed = `${drive[1]}:${drive[2]}`;
  const doubled = trimmed.match(/^([a-zA-Z]):[\\/]+\1:[\\/]+(.*)$/i);
  if (doubled) trimmed = `${doubled[1]}:\\${doubled[2]}`;
  return path.resolve(trimmed);
}

function canonicalWorkspaceRoot(workspacePath) {
  const root = nativeWorkspaceRoot(workspacePath);
  if (!root) return null;
  try {
    return fs.realpathSync.native(root);
  } catch {
    return root;
  }
}

function canonicalWorkspaceFile(workspacePath, filePath) {
  const root = canonicalWorkspaceRoot(workspacePath);
  if (!root || typeof filePath !== "string" || !filePath.trim()) return null;
  let supplied = filePath.trim().replace(/\\/g, "/");
  const rootPosix = root.replace(/\\/g, "/");
  if (supplied.startsWith("/") || /^[a-zA-Z]:\//.test(supplied)) {
    const rootNorm = process.platform === "win32" ? rootPosix.toLowerCase() : rootPosix;
    const suppliedNorm = process.platform === "win32" ? supplied.toLowerCase() : supplied;
    if (suppliedNorm === rootNorm || suppliedNorm.startsWith(rootNorm + "/")) {
      supplied = supplied.slice(rootPosix.length).replace(/^\/+/, "");
    } else {
      return null;
    }
  }

  const normalized = path.posix.normalize(supplied);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  let candidate = path.resolve(root, ...normalized.split("/"));
  const withinRoot = (target) => {
    const relative = path.relative(root, target);
    const comparable = process.platform === "win32" ? relative.toLowerCase() : relative;
    return comparable !== ".." && !comparable.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  };
  if (!withinRoot(candidate)) return null;

  const missing = [];
  while (true) {
    try {
      const realParent = fs.realpathSync.native(candidate);
      candidate = path.resolve(realParent, ...missing.reverse());
      break;
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") return null;
      const parent = path.dirname(candidate);
      if (parent === candidate) return null;
      missing.push(path.basename(candidate));
      candidate = parent;
    }
  }
  if (!withinRoot(candidate)) return null;
  const relative = path.relative(root, candidate);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  const posix = relative.split(path.sep).join("/");
  return process.platform === "win32" ? posix.toLowerCase() : posix;
}

function workspaceLatchDir(root) {
  const latchDir = path.join(root, ".latch");
  const relayDir = path.join(root, ".relay");
  if (fs.existsSync(latchDir)) return latchDir;
  if (fs.existsSync(relayDir)) return relayDir;
  return latchDir;
}

function coordinatorStatePath(workspacePath) {
  if (workspacePath) {
    const root = nativeWorkspaceRoot(workspacePath);
    const dir = workspaceLatchDir(root);
    if (tryMkdir(dir)) return path.join(dir, "coordinator-state.json");
  }
  return path.join(homeLatchDir(), "coordinator-state.json");
}

function normKey(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function locksDirFor(workspacePath) {
  const homeLocks = path.join(homeLatchDir(), "locks");
  if (!workspacePath) {
    tryMkdir(homeLocks);
    return homeLocks;
  }
  const root = nativeWorkspaceRoot(workspacePath);
  const dir = path.join(workspaceLatchDir(root), "locks");
  if (tryMkdir(dir)) return dir;
  const slug = crypto.createHash("sha256").update(normKey(root)).digest("hex").slice(0, 16);
  const fallback = path.join(homeLocks, slug);
  tryMkdir(fallback);
  return fallback;
}

module.exports = {
  homeLatchDir,
  homeRelayDir,
  dataDir,
  registryPath,
  sessionPath,
  coordinatorStatePath,
  locksDirFor,
  canonicalWorkspaceRoot,
  canonicalWorkspaceFile,
};
