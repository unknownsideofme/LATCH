import { supabase } from "../config/supabase.js";

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export const UserModel = {
  async findById(id) {
    const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    return data;
  },

  async findByUsername(username) {
    const clean = username.trim().toLowerCase();
    const { data } = await supabase.from("users").select("*").eq("username", clean).maybeSingle();
    return data;
  },

  async findWithProjects(userId) {
    const { data } = await supabase.from("users").select("*, projects(*)").eq("id", userId).maybeSingle();
    return data;
  },

  async register({ email, password, username, name, projectLimit = 3 }) {
    const cleanUsername = username.trim().toLowerCase();

    if (!USERNAME_REGEX.test(cleanUsername)) {
      throw new Error("Username must be between 3 and 30 alphanumeric characters or underscores");
    }

    // Verify username uniqueness
    const existing = await this.findByUsername(cleanUsername);
    if (existing) throw new Error(`Username '${cleanUsername}' is already taken`);

    // Create Supabase Auth user via admin API (auto-confirms and preserves service_role headers)
    const { data: auth, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { username: cleanUsername, name: name || cleanUsername },
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
    if (dbError) throw dbError;

    // Return active session immediately upon registration
    const loginResult = await this.authenticate(email.trim(), password).catch(() => ({ session: null }));

    return { user: user || profile, session: loginResult.session };
  },

  async authenticate(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    let profile = await this.findById(data.user.id);
    if (!profile) {
      const username = data.user.user_metadata?.username || `user_${data.user.id.slice(0, 8)}`;
      const { data: created } = await supabase.from("users").insert([{
        id: data.user.id,
        username,
        email: data.user.email,
        name: data.user.user_metadata?.name || username,
        project_limit: 3,
      }]).select().maybeSingle();
      profile = created;
    }
    return { user: profile || data.user, session: data.session };
  },
};
