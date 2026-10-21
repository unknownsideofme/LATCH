import { supabase } from "../config/supabase.js";

export const ProjectModel = {
  async findById(id) {
    const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    return data;
  },

  async findByRenderId(renderId) {
    const { data } = await supabase.from("projects").select("*").eq("render_id", renderId).maybeSingle();
    return data;
  },

  async listByUser(userId, { status, limit, offset, includeDeleted = false } = {}) {
    let q = supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (status) {
      q = q.eq("status", status);
    } else if (!includeDeleted) {
      q = q.neq("status", "deleted");
    }
    if (limit) q = q.range(offset || 0, (offset || 0) + limit - 1);
    const { data } = await q;
    return data || [];
  },

  async countByUser(userId) {
    // Exclude terminal / deleting statuses from user quota
    const { count } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("status", "in", '("deleted","deleting")');
    return count || 0;
  },

  async create({ userId, projectName, agentLimit = 7, repoUrl, branch }) {
    // Validate user's project limit
    const { data: user } = await supabase.from("users").select("project_limit").eq("id", userId).maybeSingle();
    if (user?.project_limit != null) {
      const currentCount = await this.countByUser(userId);
      if (currentCount >= user.project_limit) {
        throw new Error(`Project limit reached (${currentCount}/${user.project_limit})`);
      }
    }

    const baseProject = {
      user_id: userId,
      project_name: projectName.trim(),
      status: "pending",
      agent_limit: Number(agentLimit) || 7,
    };

    // Attempt to insert with repo_url and branch if columns exist
    const fullProject = { ...baseProject };
    if (repoUrl) fullProject.repo_url = repoUrl;
    if (branch) fullProject.branch = branch;

    let { data, error } = await supabase.from("projects").insert([fullProject]).select().single();

    // Gracefully fallback to base columns if branch or repo_url columns are pending schema migration
    if (error && (error.message?.includes("schema cache") || error.code === "PGRST204")) {
      const fallback = await supabase.from("projects").insert([baseProject]).select().single();
      if (fallback.error) throw fallback.error;
      data = {
        ...fallback.data,
        repo_url: repoUrl || "https://github.com/unknownsideofme/LATCH",
        branch: branch || "main",
      };
    } else if (error) {
      throw error;
    }

    return data;
  },

  async update(id, updates) {
    let { data, error } = await supabase.from("projects").update(updates).eq("id", id).select().single();
    if (error && (error.message?.includes("schema cache") || error.code === "PGRST204")) {
      const sanitized = { ...updates };
      delete sanitized.branch;
      delete sanitized.repo_url;
      const fallback = await supabase.from("projects").update(sanitized).eq("id", id).select().single();
      if (fallback.error) throw fallback.error;
      data = { ...fallback.data, ...updates };
    } else if (error) {
      throw error;
    }
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};
