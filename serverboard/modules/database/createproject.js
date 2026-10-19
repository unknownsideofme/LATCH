import { supabase } from "./connect.js";

/**
 * Default fallback values for project creation
 */
export const DEFAULT_AGENT_LIMIT = 5;
export const DEFAULT_PROJECT_STATUS = "active";

/**
 * Creates a new project in the `projects` table.
 *
 * @param {Object} params
 * @param {string} params.userId - UUID of the owner (references users.id)
 * @param {string} params.projectName - Name of the project
 * @param {string} [params.renderId] - Render service ID (e.g. srv-xxx)
 * @param {string} [params.renderUrl] - Public Render URL (e.g. https://xxx.onrender.com)
 * @param {string} [params.status="active"] - Initial status (e.g. "active", "creating", "deploying")
 * @param {number} [params.agentLimit=5] - Maximum number of concurrent AI agents allowed
 * @param {boolean} [params.checkLimit=true] - Verify against the user's project_limit before creating
 * @returns {Promise<Object>} The created project record
 */
export async function createProject({
  userId,
  projectName,
  renderId = null,
  renderUrl = null,
  status = DEFAULT_PROJECT_STATUS,
  agentLimit = DEFAULT_AGENT_LIMIT,
  checkLimit = true,
}) {
  if (!userId) {
    throw new Error("userId (UUID) is required to create a project");
  }

  if (!projectName || !projectName.trim()) {
    throw new Error("projectName is required to create a project");
  }

  const cleanProjectName = projectName.trim();

  // 1. Optional project limit verification against user profile
  if (checkLimit) {
    const { data: userProfile, error: userError } = await supabase
      .from("users")
      .select("project_limit")
      .eq("id", userId)
      .maybeSingle();

    if (!userError && userProfile && userProfile.project_limit != null) {
      const { count, error: countError } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (!countError && count != null && count >= userProfile.project_limit) {
        throw new Error(
          `Project limit reached for this user (${count}/${userProfile.project_limit}). Upgrade limit to create more.`
        );
      }
    }
  }

  // 2. Prepare database record matching the `projects` schema
  const record = {
    user_id: userId,
    project_name: cleanProjectName,
    render_id: renderId || null,
    render_url: renderUrl || null,
    status: status || DEFAULT_PROJECT_STATUS,
    agent_limit: Number(agentLimit) || DEFAULT_AGENT_LIMIT,
  };

  // 3. Insert into the `projects` table
  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert([record])
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create project in database: ${insertError.message}`);
  }

  return project;
}

/**
 * Retrieves a single project by its primary key ID.
 *
 * @param {string} projectId - Project UUID
 * @returns {Promise<Object|null>}
 */
export async function getProjectById(projectId) {
  if (!projectId) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch project: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves all projects owned by a specific user.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Array<Object>>}
 */
export async function getProjectsByUserId(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list projects for user: ${error.message}`);
  }

  return data || [];
}

/**
 * Updates an existing project record (e.g. status, render_id, render_url).
 *
 * @param {string} projectId - Project UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
export async function updateProject(projectId, updates = {}) {
  if (!projectId) {
    throw new Error("projectId is required to update a project");
  }

  const allowedFields = [
    "project_name",
    "render_id",
    "render_url",
    "status",
    "agent_limit",
  ];

  const patch = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      patch[field] = updates[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No valid fields provided for update");
  }

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update project: ${error.message}`);
  }

  return data;
}

/**
 * Deletes a project by ID.
 *
 * @param {string} projectId - Project UUID
 * @returns {Promise<boolean>}
 */
export async function deleteProject(projectId) {
  if (!projectId) {
    throw new Error("projectId is required to delete a project");
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }

  return true;
}

// Execute when run directly: `node serverboard/modules/database/createproject.js`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("/database/createproject.js") ||
    process.argv[1].endsWith("\\database\\createproject.js"));

if (isDirectRun) {
  const [,, userId, projectName, renderId, renderUrl] = process.argv;

  if (!userId || !projectName) {
    console.log("Usage: node serverboard/modules/database/createproject.js <userId> <projectName> [renderId] [renderUrl]");
    process.exit(1);
  }

  try {
    console.log(`Creating project '${projectName}' for user ${userId}...`);
    const project = await createProject({
      userId,
      projectName,
      renderId,
      renderUrl,
    });
    console.log("✔ Project created successfully!");
    console.log(project);
  } catch (err) {
    console.error("✖ Project creation failed:", err.message);
    process.exit(1);
  }
}
