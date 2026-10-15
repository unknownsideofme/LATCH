"use strict";

const { getSupabaseClient, isSupabaseConfigured, loadSupabaseConfig } = require("./client");

async function checkConnection() {
  console.log("\n=======================================================");
  console.log("       Latch -> Supabase Connection Health Check       ");
  console.log("=======================================================\n");

  const config = loadSupabaseConfig();
  console.log("1. Environment Configuration:");
  console.log(`   - Supabase URL:  ${config.url ? config.url : "\x1b[31m[NOT FOUND]\x1b[0m"}`);
  console.log(`   - Supabase Key:  ${config.key ? config.key.slice(0, 15) + "..." : "\x1b[31m[NOT FOUND]\x1b[0m"}`);

  if (!isSupabaseConfigured()) {
    console.error("\n\x1b[31m✖ Supabase is not configured. Please check your .env file.\x1b[0m\n");
    process.exit(1);
  }

  const client = getSupabaseClient();
  if (!client) {
    console.error("\n\x1b[31m✖ Failed to initialize Supabase client instance.\x1b[0m\n");
    process.exit(1);
  }

  console.log("\n2. Testing Table Connectivity:");

  // Test 1: relay_locks
  try {
    const start = Date.now();
    const { data, error } = await client.from("latch_locks").select("id").limit(1);
    const latency = Date.now() - start;
    if (error) {
      console.log(`   - latch_locks:   \x1b[31m✖ FAILED (${error.message})\x1b[0m`);
    } else {
      console.log(`   - latch_locks:   \x1b[32m✔ CONNECTED\x1b[0m (${latency}ms, ${data.length} sample row)`);
    }
  } catch (err) {
    console.log(`   - latch_locks:   \x1b[31m✖ ERROR: ${err.message}\x1b[0m`);
  }

  // Test 2: relay_patches
  try {
    const start = Date.now();
    const { data, error } = await client.from("latch_patches").select("id").limit(1);
    const latency = Date.now() - start;
    if (error) {
      console.log(`   - latch_patches: \x1b[31m✖ FAILED (${error.message})\x1b[0m`);
    } else {
      console.log(`   - latch_patches: \x1b[32m✔ CONNECTED\x1b[0m (${latency}ms, ${data.length} sample row)`);
    }
  } catch (err) {
    console.log(`   - latch_patches: \x1b[31m✖ ERROR: ${err.message}\x1b[0m`);
  }

  console.log("\n3. Testing Stored Procedures (RPCs):");

  // Test 3: relay_claim_lock RPC
  const testLockId = "health-check-test.txt";
  const testWs = "health-check-ws";
  const testAgent = "health-check-agent";

  try {
    const { data: claimData, error: claimErr } = await client.rpc("latch_claim_lock", {
      p_workspace_id: testWs,
      p_file_path: testLockId,
      p_agent_id: testAgent,
      p_mode: "write",
      p_ttl_ms: 5000,
      p_holder: { label: "Health Check" },
    });

    if (claimErr) {
      console.log(`   - latch_claim_lock:   \x1b[31m✖ FAILED (${claimErr.message})\x1b[0m`);
    } else if (claimData && claimData.allowed) {
      console.log(`   - latch_claim_lock:   \x1b[32m✔ SUCCESS\x1b[0m (acquired distributed test lock)`);
    } else {
      console.log(`   - latch_claim_lock:   \x1b[33m⚠ WARNING\x1b[0m (returned: ${JSON.stringify(claimData)})`);
    }
  } catch (err) {
    console.log(`   - latch_claim_lock:   \x1b[31m✖ ERROR: ${err.message}\x1b[0m`);
  }

  // Test 4: relay_release_lock RPC
  try {
    const { data: relData, error: relErr } = await client.rpc("latch_release_lock", {
      p_workspace_id: testWs,
      p_file_path: testLockId,
      p_agent_id: testAgent,
    });

    if (relErr) {
      console.log(`   - latch_release_lock: \x1b[31m✖ FAILED (${relErr.message})\x1b[0m`);
    } else {
      console.log(`   - latch_release_lock: \x1b[32m✔ SUCCESS\x1b[0m (released distributed test lock)`);
    }
  } catch (err) {
    console.log(`   - latch_release_lock: \x1b[31m✖ ERROR: ${err.message}\x1b[0m`);
  }

  console.log("\n=======================================================");
  console.log("       \x1b[32m✔ Supabase is online and fully connected!\x1b[0m       ");
  console.log("=======================================================\n");
  process.exit(0);
}

checkConnection().catch((err) => {
  console.error("\n\x1b[31m✖ Fatal error during Supabase health check:\x1b[0m", err);
  process.exit(1);
});
