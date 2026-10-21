const fs = require("fs");
const path = require("path");
const { extractWithQuery, languageForExt, supportedLanguages } = require("./treeSitterImports");
const { sameOwner } = require("../coordinator/lockTable");
const { normalizeWorkspaceRoot } = require("./transcripts/util");
const { loadRegistry } = require("./store");
const { getRecentPatches } = require("./patches");

const SKIP = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "dist",
  "coverage",
  ".latch",
  ".relay",
]);
const SOURCE = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".cs",
  ".cpp",
  ".cc",
  ".cxx",
  ".h",
  ".hpp",
  ".php",
  ".rb",
]);

function posix(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\.?\//, "");
}

function walk(root, rel = "", out = []) {
  const dir = path.join(root, rel);
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(root, child, out);
    else if (SOURCE.has(path.extname(e.name))) out.push(child.replace(/\\/g, "/"));
  }
  return out;
}

function loadOverride(workspacePath) {
  try {
    const latchPath = path.join(workspacePath, ".latch", "deps.json");
    const relayPath = path.join(workspacePath, ".relay", "deps.json");
    const file = fs.existsSync(latchPath) ? latchPath : (fs.existsSync(relayPath) ? relayPath : latchPath);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { lockDepth: 1, edges: [] };
  }
}

function tryResolve(root, fromFile, spec, ext) {
  if (!spec || spec.startsWith("http")) return null;
  const dir = path.posix.dirname(fromFile);

  if (spec.startsWith(".")) {
    const rel = path.posix.normalize(path.posix.join(dir, spec)).replace(/^\.\//, "");
    return resolveExisting(root, rel, ext);
  }

  if (ext === ".py") {
    const rel = spec.replace(/\./g, "/");
    return resolveExisting(root, rel, ".py") || resolveExisting(root, path.posix.join(dir, rel), ".py");
  }
  if (ext === ".java" || ext === ".cs") {
    const rel = spec.replace(/\./g, "/");
    return resolveExisting(root, rel, ext);
  }
  if (ext === ".rs" && !spec.includes("::") && !["crate", "self", "super", "std", "core"].includes(spec)) {
    return resolveExisting(root, path.posix.join(dir, spec), ".rs");
  }
  if (ext === ".rs" && spec.startsWith("super::")) {
    const name = spec.split("::").pop();
    return resolveExisting(root, path.posix.join(path.posix.dirname(dir), name), ".rs");
  }
  if ((ext === ".php" || ext === ".rb") && (spec.startsWith(".") || spec.includes("/"))) {
    return resolveExisting(root, path.posix.join(dir, spec), ext);
  }
  if (ext === ".go" && (spec.startsWith("./") || spec.startsWith("../"))) {
    return resolveExisting(root, path.posix.normalize(path.posix.join(dir, spec)), ".go");
  }

  return { kind: "external", spec };
}

function resolveExisting(root, rel, hintExt) {
  const bases = [
    rel,
    `${rel}.ts`,
    `${rel}.tsx`,
    `${rel}.js`,
    `${rel}.jsx`,
    `${rel}.mjs`,
    `${rel}.py`,
    `${rel}.go`,
    `${rel}.rs`,
    `${rel}.java`,
    `${rel}.cs`,
    `${rel}.php`,
    `${rel}.rb`,
    `${rel}.h`,
    `${rel}.hpp`,
    path.posix.join(rel, "index.ts"),
    path.posix.join(rel, "index.js"),
    path.posix.join(rel, "__init__.py"),
    path.posix.join(rel, "mod.rs"),
  ];
  if (hintExt) bases.unshift(rel + hintExt);
  for (const c of bases) {
    const abs = path.join(root, c);
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return { kind: "file", spec: c.replace(/\\/g, "/") };
    } catch {
      /* skip */
    }
  }
  return { kind: "missing", spec: rel };
}

function extractSpecs(source, ext) {
  const lang = languageForExt(ext);
  if (lang) {
    const result = extractWithQuery(lang, source);
    if (result.engine === "tree-sitter") return result;
  }
  return { staticSpecs: [], dynamic: [], engine: "none" };
}

function stronglyConnected(nodes, imports) {
  const index = new Map();
  const low = new Map();
  const stack = [];
  const on = new Set();
  const sccs = [];
  let i = 0;
  function strong(v) {
    index.set(v, i);
    low.set(v, i);
    i += 1;
    stack.push(v);
    on.add(v);
    for (const w of imports.get(v) || []) {
      if (!index.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (on.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp = [];
      while (true) {
        const w = stack.pop();
        on.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      sccs.push(comp);
    }
  }
  for (const n of nodes) if (!index.has(n)) strong(n);
  const owner = new Map();
  for (const comp of sccs) {
    const id = comp.slice().sort().join("|");
    for (const n of comp) owner.set(n, { id, members: comp, cyclic: comp.length > 1 });
  }
  return owner;
}

class DepGraph {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.imports = new Map();
    this.importedBy = new Map();
    this.unresolvable = [];
    this.cycles = [];
    this.scc = new Map();
    this.lockDepth = 1;
    this.builtAt = 0;
    this.engine = "none";
  }

  build() {
    const override = loadOverride(this.workspacePath);
    this.lockDepth = Number(override.lockDepth || process.env.LATCH_LOCK_DEPTH || process.env.RELAY_LOCK_DEPTH || 1);
    this.imports = new Map();
    this.importedBy = new Map();
    this.unresolvable = [];
    const files = walk(this.workspacePath);
    for (const file of files) {
      if (!this.imports.has(file)) this.imports.set(file, new Set());
      if (!this.importedBy.has(file)) this.importedBy.set(file, new Set());
      let src = "";
      try {
        src = fs.readFileSync(path.join(this.workspacePath, file), "utf8");
      } catch {
        continue;
      }
      const ext = path.extname(file);
      const { staticSpecs, dynamic, engine } = extractSpecs(src, ext);
      this.engine = engine || this.engine;
      for (const d of dynamic) {
        this.unresolvable.push({ from: file, spec: d, reason: "dynamic" });
      }
      for (const spec of staticSpecs) {
        const resolved = tryResolve(this.workspacePath, file, spec, ext);
        if (!resolved || resolved.kind !== "file") {
          if (resolved && resolved.kind === "missing" && spec.startsWith(".")) {
            this.unresolvable.push({ from: file, spec, reason: "missing" });
          }
          continue;
        }
        this.imports.get(file).add(resolved.spec);
        if (!this.importedBy.has(resolved.spec)) this.importedBy.set(resolved.spec, new Set());
        this.importedBy.get(resolved.spec).add(file);
      }
    }
    for (const [a, b] of override.edges || []) {
      const from = posix(a);
      const to = posix(b);
      if (!this.imports.has(from)) this.imports.set(from, new Set());
      this.imports.get(from).add(to);
      if (!this.importedBy.has(to)) this.importedBy.set(to, new Set());
      this.importedBy.get(to).add(from);
    }
    const nodes = [...this.imports.keys()];
    this.scc = stronglyConnected(nodes, this.imports);
    this.cycles = [...new Set([...this.scc.values()].filter((s) => s.cyclic).map((s) => s.id))].map((id) => {
      const members = [...this.scc.values()].find((s) => s.id === id)?.members || [];
      return members;
    });
    this.builtAt = Date.now();
    return this;
  }

  recalculateCycles() {
    const nodes = [...this.imports.keys()];
    this.scc = stronglyConnected(nodes, this.imports);
    this.cycles = [...new Set([...this.scc.values()].filter((entry) => entry.cyclic).map((entry) => entry.id))].map((id) =>
      [...this.scc.values()].find((entry) => entry.id === id)?.members || []
    );
  }

  updateFile(filePath) {
    const file = posix(filePath);
    const oldImports = this.imports.get(file) || new Set();
    const existingImporters = this.importedBy.get(file) || new Set();
    for (const imported of oldImports) this.importedBy.get(imported)?.delete(file);
    this.imports.delete(file);
    this.unresolvable = this.unresolvable.filter((entry) => entry.from !== file);
    const abs = path.join(this.workspacePath, file);
    const exists = fs.existsSync(abs) && fs.statSync(abs).isFile() && SOURCE.has(path.extname(file));
    if (exists) {
      this.imports.set(file, new Set());
      this.importedBy.set(file, existingImporters);
      let source = "";
      try { source = fs.readFileSync(abs, "utf8"); } catch { source = null; }
      if (source !== null) {
        const ext = path.extname(file);
        const { staticSpecs, dynamic, engine } = extractSpecs(source, ext);
        this.engine = engine || this.engine;
        for (const spec of dynamic) this.unresolvable.push({ from: file, spec, reason: "dynamic" });
        for (const spec of staticSpecs) {
          const resolved = tryResolve(this.workspacePath, file, spec, ext);
          if (!resolved || resolved.kind !== "file") {
            if (resolved?.kind === "missing" && spec.startsWith(".")) this.unresolvable.push({ from: file, spec, reason: "missing" });
            continue;
          }
          this.imports.get(file).add(resolved.spec);
          if (!this.importedBy.has(resolved.spec)) this.importedBy.set(resolved.spec, new Set());
          this.importedBy.get(resolved.spec).add(file);
        }
      }
      for (const [from, to] of loadOverride(this.workspacePath).edges || []) {
        if (posix(from) !== file) continue;
        if (!this.imports.has(file)) this.imports.set(file, new Set());
        this.imports.get(file).add(posix(to));
        if (!this.importedBy.has(posix(to))) this.importedBy.set(posix(to), new Set());
        this.importedBy.get(posix(to)).add(file);
      }
    } else {
      for (const importer of existingImporters) this.imports.get(importer)?.delete(file);
      this.importedBy.delete(file);
    }
    this.recalculateCycles();
    this.builtAt = Date.now();
    return this;
  }

  removeFile(filePath) {
    return this.updateFile(filePath);
  }

  walk(start, map, depth) {
    const out = new Set();
    const q = [{ file: posix(start), d: 0 }];
    const seen = new Set();
    while (q.length) {
      const { file, d } = q.shift();
      if (d >= depth) continue;
      for (const n of map.get(file) || []) {
        if (seen.has(n)) continue;
        seen.add(n);
        out.add(n);
        q.push({ file: n, d: d + 1 });
      }
    }
    return [...out];
  }

  dependencies(file, depth = this.lockDepth) {
    return this.walk(file, this.imports, depth);
  }

  dependents(file, depth = this.lockDepth) {
    return this.walk(file, this.importedBy, depth);
  }

  cycleMembers(file) {
    return this.scc.get(posix(file))?.members || [posix(file)];
  }

  /**
   * Soft-lock if an upstream import is held, or another file in this SCC is held.
   */
  blockedBy(file, isHeld, patchFor) {
    const rel = posix(file);
    const freshness = {
      lastUpdatedAt: this.builtAt,
      confidence: this.unresolvable.length ? "PARTIAL_PARSE_ERROR" : "FULL",
    };
    for (const member of this.cycleMembers(rel)) {
      if (member === rel) continue;
      const holder = isHeld(member);
      if (holder) {
        return {
          soft: true,
          targetPath: rel,
          file: member,
          holder,
          category: "CIRCULAR_DEPENDENCY_RISK",
          relationType: "circular_scc",
          cycleCluster: this.cycleMembers(rel),
          graphFreshness: freshness,
          recentPatches: patchFor ? patchFor(member, holder) : [],
          reason: `⚠️ \`${rel}\` is in a circular dependency with \`${member}\` (single lock unit). Held by ${holder}. Pick a different file.`,
        };
      }
    }
    for (const dep of this.dependencies(rel, this.lockDepth)) {
      const holder = isHeld(dep);
      if (holder) {
        const direct = this.imports.get(rel)?.has(dep);
        return {
          soft: true,
          targetPath: rel,
          file: dep,
          holder,
          category: direct ? "DIRECT_DEPENDENCY_RISK" : "TRANSITIVE_DEPENDENCY_RISK",
          relationType: direct ? "direct_import" : "transitive",
          graphFreshness: freshness,
          recentPatches: patchFor ? patchFor(dep, holder) : [],
          reason: `⚠️ \`${rel}\` depends on \`${dep}\`, which is currently being modified by ${holder}. Proceeding may cause inconsistencies. Pick a different file.`,
        };
      }
    }
    return null;
  }

  snapshot(lockedFiles = []) {
    const locked = new Set(lockedFiles.map(posix));
    const focus = new Set(locked);
    for (const f of locked) {
      for (const d of this.dependents(f, 1)) focus.add(d);
      for (const d of this.dependencies(f, 1)) focus.add(d);
      for (const d of this.cycleMembers(f)) focus.add(d);
    }
    const degrees = [...this.imports.keys()].map((n) => ({
      n,
      deg: (this.imports.get(n)?.size || 0) + (this.importedBy.get(n)?.size || 0),
    }));
    degrees.sort((a, b) => b.deg - a.deg);
    for (const { n } of degrees.slice(0, 48)) focus.add(n);

    const nodes = [...focus].filter((n) => this.imports.has(n) || this.importedBy.has(n));
    const nodeSet = new Set(nodes);
    const edges = [];
    for (const from of nodes) {
      for (const to of this.imports.get(from) || []) {
        if (nodeSet.has(to)) edges.push({ from, to });
      }
    }
    return {
      lockDepth: this.lockDepth,
      engine: this.engine || "tree-sitter",
      languages: supportedLanguages(),
      builtAt: this.builtAt,
      fileCount: this.imports.size,
      edgeCount: [...this.imports.values()].reduce((n, s) => n + s.size, 0),
      cycles: this.cycles,
      unresolvable: this.unresolvable.slice(0, 40),
      nodes: nodes.map((id) => ({
        id,
        imports: [...(this.imports.get(id) || [])],
        dependents: [...(this.importedBy.get(id) || [])],
        cyclic: Boolean(this.scc.get(id)?.cyclic),
        locked: locked.has(id),
      })),
      edges,
    };
  }
}

const cache = new Map();

function resolveRoot(workspacePath) {
  return normalizeWorkspaceRoot(workspacePath) || workspacePath;
}

function graphFor(workspacePath) {
  const root = resolveRoot(workspacePath);
  if (!root || !fs.existsSync(root)) return null;
  let g = cache.get(root);
  if (!g) {
    g = new DepGraph(root).build();
    cache.set(root, g);
  }
  return g;
}

function updateFile(workspacePath, filePath) {
  const g = graphFor(workspacePath);
  return g ? g.updateFile(filePath) : null;
}

function removeFile(workspacePath, filePath) {
  const g = graphFor(workspacePath);
  return g ? g.removeFile(filePath) : null;
}

function rebuild(workspacePath) {
  const root = resolveRoot(workspacePath);
  if (!root || !fs.existsSync(root)) return null;
  const g = new DepGraph(root).build();
  cache.set(root, g);
  return g;
}

function holderOf(lockTable, file, agentId, workspacePath) {
  const e = typeof lockTable.getLock === "function" ? lockTable.getLock(file, workspacePath) : null;
  if (!e) return null;
  if (sameOwner(e.agentId, agentId)) return null;
  if (Date.now() >= (e.lastHeartbeat || e.claimedAt) + e.ttlMs) return null;
  return e.holder?.label || e.agentId;
}

function dependencyRiskReport(blocked) {
  if (!blocked?.soft) return null;
  const patches = blocked.recentPatches || [];
  return {
    targetPath: blocked.targetPath,
    category: blocked.category,
    severity: "WARNING",
    conflictingFiles: [{ path: blocked.file, heldByAgent: blocked.holder, relationType: blocked.relationType }],
    ...(blocked.cycleCluster ? { cycleCluster: blocked.cycleCluster } : {}),
    graphFreshness: blocked.graphFreshness,
    advisoryMessage: blocked.reason,
    suggestedAction: patches.length
      ? "Review the attached recent patch context before editing."
      : "Review the conflicting file before editing; no recent patch context is available.",
    recentPatches: patches,
  };
}

function projectIdFor(workspacePath) {
  const root = resolveRoot(workspacePath);
  const projects = loadRegistry()?.projects || [];
  return projects.find((project) => resolveRoot(project.path) === root)?.id || (projects.some((p) => p.id === workspacePath) ? workspacePath : null);
}

function softBlock(lockTable, workspacePath, agentId, file) {
  const g = graphFor(workspacePath);
  if (!g) return null;
  const projectId = projectIdFor(workspacePath);
  const patchFor = (conflictingFile, holder) =>
    projectId ? getRecentPatches(projectId, conflictingFile, holder, 3) : [];
  return g.blockedBy(file, (f) => holderOf(lockTable, f, agentId, workspacePath), patchFor);
}

module.exports = { DepGraph, graphFor, rebuild, updateFile, removeFile, posix, softBlock, dependencyRiskReport };
