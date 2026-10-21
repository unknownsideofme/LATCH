import { githubTokenCache } from "./authController.js";

export const GithubController = {
  /**
   * Respond with `{ repos }` from the first GitHub repository page, requesting up
   * to 100 entries sorted by update time. Prefer `x-github-token` over the token
   * cached for `req.user.id`; return HTTP 403 with `no_github_token` if neither exists.
   * GitHub failures retain the upstream status and return `github_api_failed` with
   * the response text in `details`. Fetch and response parsing errors go to `next`.
   */
  async listRepos(req, res, next) {
    try {
      const userId = req.user?.id;
      const headerToken = req.headers["x-github-token"];
      const token = headerToken || (userId ? githubTokenCache.get(userId) : null);

      if (!token) {
        return res.status(403).json({
          error: "no_github_token",
          message: "User is not authenticated with GitHub OAuth or token is expired",
        });
      }

      const ghRes = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Latch-Serverboard-API",
        },
      });

      if (!ghRes.ok) {
        const errText = await ghRes.text();
        return res.status(ghRes.status).json({
          error: "github_api_failed",
          details: errText,
        });
      }

      const repos = await ghRes.json();
      res.json({ repos });
    } catch (err) {
      next(err);
    }
  },
};
