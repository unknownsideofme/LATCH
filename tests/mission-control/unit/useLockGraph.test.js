"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("mission-control useLockGraph: parseAgentId handles labels, hosts, sessions, and @login suffix", async () => {
  const { parseAgentId } = await import("../../../mission-control/components/lockgraph/useLockGraph.ts");

  const parsed1 = parseAgentId("Cursor:my-mac:session123");
  assert.equal(parsed1.label, "Cursor");
  assert.equal(parsed1.host, "my-mac");
  assert.equal(parsed1.session, "session123");
  assert.equal(parsed1.login, null);

  const parsed2 = parseAgentId("Claude:server:sess@alice");
  assert.equal(parsed2.label, "Claude");
  assert.equal(parsed2.host, "server");
  assert.equal(parsed2.login, "alice");

  const parsedEmpty = parseAgentId("");
  assert.equal(parsedEmpty.label, "agent");
  assert.equal(parsedEmpty.host, "");
});

test("mission-control useLockGraph: agentKey produces stable identifier without session churn", async () => {
  const { agentKey } = await import("../../../mission-control/components/lockgraph/useLockGraph.ts");

  const key1 = agentKey("Cursor:host1:turn1");
  const key2 = agentKey("Cursor:host1:turn2");
  assert.equal(key1, key2);
  assert.equal(key1, "Cursor:host1");

  const keyWithLogin = agentKey("Claude:host1:turn1@bob");
  assert.equal(keyWithLogin, "bob::Claude:host1");
});

test("mission-control useLockGraph: makeResolveUser attributes locks to collaborators or hosts", async () => {
  const { makeResolveUser } = await import("../../../mission-control/components/lockgraph/useLockGraph.ts");

  const me = { id: "1", login: "me_dev", name: "My Name", avatarUrl: null };
  const collaborators = [
    { login: "alice", name: "Alice Wonderland", avatarUrl: "https://avatar.com/alice", online: true },
  ];

  const resolver = makeResolveUser([], me, collaborators, false);

  // 1. holder with login matches collaborator
  const u1 = resolver("Cursor:host1:s1", { login: "alice" });
  assert.equal(u1.login, "alice");
  assert.equal(u1.name, "Alice Wonderland");
  assert.equal(u1.avatarUrl, "https://avatar.com/alice");

  // 2. agentId ending with @login
  const u2 = resolver("Cursor:host1:s1@alice");
  assert.equal(u2.login, "alice");

  // 3. Fallback to host
  const resolverShared = makeResolveUser([{ agentId: "Cursor:host1:s1" }, { agentId: "Claude:host2:s2" }], me, collaborators, true);
  const u3 = resolverShared("Cursor:host1:s1");
  assert.equal(u3.login, "host1");
});
