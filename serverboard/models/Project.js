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

  async listByUser(userId, { status, limit, offset } = {}) {
    let q = supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    if (limit) q = q.range(offset || 0, (offset || 0) + limit - 1);
    const { data } = await q;
    return data || [];
  },

  async countByUser(userId) {
    const { count } = await supabase.from("projects").select("*", { count: "exact", head: true }).eq("user_id", userId);
    return count || 0;
  },

  async create({ userId, projectName, agentLimit = 5 }) {
    // Validate user's project limit
    const { data: user } = await supabase.from("users").select("project_limit").eq("id", userId).maybeSingle();
    if (user?.project_limit != null) {
      const currentCount = await this.countByUser(userId);
      if (currentCount >= user.project_limit) {
        throw new Error(`Project limit reached (${currentCount}/${user.project_limit})`);
      }
    }

    const { data, error } = await supabase
      .from("projects")
      .insert([{
        user_id: userId,
        project_name: projectName.trim(),
        status: "queued",
        agent_limit: Number(agentLimit) || 5,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase.from("projects").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};
