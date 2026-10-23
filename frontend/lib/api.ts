import type { UserProfile, GitHubRepo, ProjectRecord, ProjectLog, ProjectDeploy } from "./types";

const SERVERBOARD_URL = (
  process.env.NEXT_PUBLIC_SERVERBOARD_URL || "http://localhost:4000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${SERVERBOARD_URL}${path}`;

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Send HttpOnly cookies automatically
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const errorMsg =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const api = {
  auth: {
    async register(params: {
      email: string;
      password: string;
      username: string;
      name?: string;
    }): Promise<{ message: string; session?: any; user?: UserProfile }> {
      return request<{ message: string; session?: any; user?: UserProfile }>(
        "/api/v1/auth/register",
        {
          method: "POST",
          body: JSON.stringify(params),
        }
      );
    },

    async login(params: {
      email: string;
      password: string;
    }): Promise<{ message: string; session?: any; user?: UserProfile }> {
      return request<{ message: string; session?: any; user?: UserProfile }>(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify(params),
        }
      );
    },

    async me(): Promise<{ user: UserProfile }> {
      return request<{ user: UserProfile }>("/api/v1/auth/me");
    },

    getGithubOAuthUrl(): string {
      return `${SERVERBOARD_URL}/api/v1/auth/github`;
    },

    async logout(): Promise<void> {
      try {
        await request<{ message: string }>("/api/v1/auth/logout", {
          method: "POST",
        });
      } catch (err) {
        console.warn("[auth] Server logout request failed:", err);
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem("latch_token");
        localStorage.removeItem("latch_user_session");
      }
    },
  },

  github: {
    async listRepos(): Promise<{ repos: GitHubRepo[] }> {
      return request<{ repos: GitHubRepo[] }>("/api/v1/github/repos");
    },
  },

  projects: {
    async list(): Promise<{ projects: ProjectRecord[] }> {
      return request<{ projects: ProjectRecord[] }>("/api/v1/projects");
    },

    async get(id: string): Promise<{ project: ProjectRecord }> {
      return request<{ project: ProjectRecord }>(`/api/v1/projects/${encodeURIComponent(id)}`);
    },

    async create(payload: {
      projectName: string;
      repo?: string;
      repo_url?: string;
      branch?: string;
      region?: string;
      agentLimit?: number;
    }): Promise<{ message: string; project: ProjectRecord; eventId?: string }> {
      return request<{ message: string; project: ProjectRecord; eventId?: string }>(
        "/api/v1/projects",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
    },

    async update(
      id: string,
      updates: {
        agent_limit?: number;
        branch?: string;
        project_name?: string;
      }
    ): Promise<{ message: string; project: ProjectRecord }> {
      return request<{ message: string; project: ProjectRecord }>(
        `/api/v1/projects/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        }
      );
    },

    async delete(id: string): Promise<{ message: string }> {
      return request<{ message: string }>(
        `/api/v1/projects/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
    },

    async getLogs(
      id: string,
      limit?: number
    ): Promise<{ renderId?: string; logs: ProjectLog[] }> {
      const q = limit ? `?limit=${limit}` : "";
      return request<{ renderId?: string; logs: ProjectLog[] }>(
        `/api/v1/projects/${encodeURIComponent(id)}/logs${q}`
      );
    },

    async getDeploys(
      id: string
    ): Promise<{ renderId?: string; deploys: ProjectDeploy[] }> {
      return request<{ renderId?: string; deploys: ProjectDeploy[] }>(
        `/api/v1/projects/${encodeURIComponent(id)}/deploys`
      );
    },

    async getHealth(
      id: string
    ): Promise<{ live: boolean; url?: string }> {
      return request<{ live: boolean; url?: string }>(
        `/api/v1/projects/${encodeURIComponent(id)}/health`
      );
    },
  },
};
