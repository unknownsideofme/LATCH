export interface UserProfile {
  id: string; // uuid references auth.users.id
  username: string;
  name: string;
  email: string | null;
  project_limit: number;
  plan_tier?: "free" | "pro";
  created_at: string;
}

export interface ProjectRecord {
  id: string; // uuid primary key
  user_id: string; // uuid references users.id
  project_name: string;
  render_id?: string | null;
  render_url?: string | null;
  status: "active" | "provisioning" | "stopped" | "archived" | string;
  agent_limit: number;
  created_at: string;
  repo_name?: string | null;
  repo_url?: string | null;
  branch?: string | null;
  language?: string | null;
  connection_status?: "connected" | "connecting" | "disconnected" | string;
}

export interface ProjectLog {
  text: string;
  timestamp?: string;
}

export interface ProjectDeploy {
  id: string;
  status: string;
  commit?: string;
  createdAt?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  updated_at: string;
}
