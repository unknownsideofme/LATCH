import { supabase } from "../config/supabase.js";

export const UserModel = {
  async findById(id) {
    const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    return data;
  },

  async findByUsername(username) {
    const { data } = await supabase.from("users").select("*").ilike("username", username.trim()).maybeSingle();
    return data;
  },

  async findWithProjects(userId) {
    const { data } = await supabase.from("users").select("*, projects(*)").eq("id", userId).maybeSingle();
    return data;
  },

  async register({ email, password, username, name, projectLimit = 3 }) {
    const cleanUsername = username.trim().toLowerCase();

    // Verify username uniqueness
    const existing = await this.findByUsername(cleanUsername);
    if (existing) throw new Error(`Username '${cleanUsername}' is already taken`);

    // Create Supabase Auth user
    const { data: auth, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: cleanUsername, name: name || cleanUsername } },
    });
    if (authError) throw authError;

    // Insert profile into users table
    const profile = {
      id: auth.user.id,
      username: cleanUsername,
      name: name?.trim() || cleanUsername,
      email: email.trim(),
      project_limit: projectLimit,
    };

    const { data: user, error: dbError } = await supabase.from("users").insert([profile]).select().single();
    if (dbError && dbError.code !== "23505") throw dbError;

    return { user: user || profile, session: auth.session };
  },

  async authenticate(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    const profile = await this.findById(data.user.id);
    return { user: profile || data.user, session: data.session };
  },
};
