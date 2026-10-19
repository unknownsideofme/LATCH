import { supabase } from "./connect.js";

/**
 * Default fallback project limit for new users
 */
export const DEFAULT_PROJECT_LIMIT = 3;

/**
 * Registers a new user with Supabase Auth (email/password) and creates
 * their profile in the `users` table.
 *
 * @param {Object} params
 * @param {string} params.email - User email address
 * @param {string} params.password - User password for Supabase Auth
 * @param {string} params.username - Unique username
 * @param {string} [params.name] - Full display name (defaults to username if omitted)
 * @param {number} [params.projectLimit=3] - Maximum projects allowed for this user
 * @returns {Promise<{ user: Object, profile: Object, session: Object|null }>}
 */
export async function registerUser({
  email,
  password,
  username,
  name,
  projectLimit = DEFAULT_PROJECT_LIMIT,
}) {
  if (!email || !password || !username) {
    throw new Error("email, password, and username are required for user registration");
  }

  const cleanUsername = username.trim().toLowerCase();
  const displayName = name ? name.trim() : username.trim();

  // 1. Check if the username is already taken in the `users` table
  const { data: existingUser, error: checkError } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", cleanUsername)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check username availability: ${checkError.message}`);
  }

  if (existingUser) {
    throw new Error(`Username '${cleanUsername}' is already taken`);
  }

  // 2. Register with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: cleanUsername,
        name: displayName,
      },
    },
  });

  if (authError) {
    throw new Error(`Authentication registration failed: ${authError.message}`);
  }

  if (!authData?.user) {
    throw new Error("Registration succeeded but no auth user was returned");
  }

  // 3. Insert profile into the `users` table
  const profileRecord = {
    id: authData.user.id,
    username: cleanUsername,
    name: displayName,
    email: email.trim(),
    project_limit: Number(projectLimit) || DEFAULT_PROJECT_LIMIT,
  };

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .insert([profileRecord])
    .select()
    .single();

  if (profileError) {
    // If the database has an automatic trigger creating the profile from auth.users,
    // fallback to upserting or reading the record.
    if (profileError.code === "23505") { // Unique violation
      const { data: existingProfile } = await supabase
        .from("users")
        .select()
        .eq("id", authData.user.id)
        .single();

      if (existingProfile) {
        return {
          user: authData.user,
          profile: existingProfile,
          session: authData.session,
        };
      }
    }
    throw new Error(`Failed to create user profile in database: ${profileError.message}`);
  }

  return {
    user: authData.user,
    profile,
    session: authData.session,
  };
}

/**
 * Creates or upserts a user record directly into the `users` table
 * (useful when the user is already authenticated via OAuth, CLI, or admin).
 *
 * @param {Object} params
 * @param {string} params.id - UUID matching auth.users.id
 * @param {string} params.username - Unique username
 * @param {string} [params.name] - User full name
 * @param {string} [params.email] - User email
 * @param {number} [params.projectLimit=3] - Maximum project limit
 * @returns {Promise<Object>} The inserted/updated user profile record
 */
export async function createUserProfile({
  id,
  username,
  name,
  email,
  projectLimit = DEFAULT_PROJECT_LIMIT,
}) {
  if (!id || !username) {
    throw new Error("id (UUID) and username are required to create a user profile");
  }

  const cleanUsername = username.trim().toLowerCase();
  const displayName = name ? name.trim() : username.trim();

  const record = {
    id,
    username: cleanUsername,
    name: displayName,
    email: email ? email.trim() : null,
    project_limit: Number(projectLimit) || DEFAULT_PROJECT_LIMIT,
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(record, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Database error creating user profile: ${error.message}`);
  }

  return data;
}

/**
 * Fetches a user by username from the `users` table.
 *
 * @param {string} username
 * @returns {Promise<Object|null>}
 */
export async function getUserByUsername(username) {
  if (!username) return null;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user by username: ${error.message}`);
  }
  return data;
}

/**
 * Fetches a user by ID from the `users` table.
 *
 * @param {string} id - User UUID
 * @returns {Promise<Object|null>}
 */
export async function getUserById(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user by id: ${error.message}`);
  }
  return data;
}

// Execute when run directly: `node serverboard/modules/database/createuser.js`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("/database/createuser.js") ||
    process.argv[1].endsWith("\\database\\createuser.js"));

if (isDirectRun) {
  const [,, email, password, username, name] = process.argv;

  if (!email || !password || !username) {
    console.log("Usage: node serverboard/modules/database/createuser.js <email> <password> <username> [name]");
    process.exit(1);
  }

  try {
    console.log(`Registering user '${username}' (${email})...`);
    const result = await registerUser({ email, password, username, name });
    console.log("✔ User registered successfully!");
    console.log("Profile:", result.profile);
  } catch (err) {
    console.error("✖ Registration failed:", err.message);
    process.exit(1);
  }
}
