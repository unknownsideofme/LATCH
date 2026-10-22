# Testing

## Commands

Run `npm ci` before running tests, matching CI's clean install from the committed lockfile.
The repository requires Node.js 20 or newer; CI validates Node 20.x and 22.x.

| Command | Files selected |
| --- | --- |
| `npm test` | Every `tests/**/*.test.js` file through Vitest |
| `npm run test:backend` | All files under `tests/backend`, including primary backend and serverboard tests |
| `npm run test:backend:unit` | `tests/backend/unit` |
| `npm run test:backend:e2e` | `tests/backend/e2e` |
| `npm run test:mission-control` | `tests/mission-control` |
| `npm run test:landing` | `tests/landing` |
| `npm run test:unit` | Backend, landing, and Mission Control unit directories |
| `npm run test:e2e` | Backend, landing, and Mission Control E2E directories |
| `npm run test:coverage` | Full Vitest suite with V8 coverage; no threshold is enforced |

To reproduce CI locally, run `npm ci`, then `npm run test:backend:unit`,
`npm run test:backend:e2e`, `npm test`, and `npm run build -w mission-control`. CI's full
suite and Mission Control build run on both supported Node.js versions; the focused
backend check runs on Node.js 22.x. Tests use temporary directories, local ephemeral
ports, and mocks. They do not need production credentials or external services.

## Inventory and audit

All current Vitest test files are listed below. All existing test suites are retained;
no redundant coverage was deleted. `frontend-api.test.js` is a cross-app contract test:
the client uses the `/api/v1` endpoints served by serverboard. It remains in the existing
backend test tree to avoid a disruptive directory reorganization.

| Test file | Production behavior covered | Audit | Action |
| --- | --- | --- | --- |
| `tests/backend/unit/collisionMetrics.test.js` | Collision counter defaults, totals, invalid inputs | Valid focused assertions | KEEP |
| `tests/backend/unit/conflicts.test.js` | Path normalization and overlapping edit detection | Valid; distinct from lock arbitration | KEEP |
| `tests/backend/unit/editMatchers.test.js` | Agent tool matcher parsing and classification | Valid | KEEP |
| `tests/backend/unit/frontend-api.test.js` | Frontend auth, GitHub, and project API client contracts | Route paths match serverboard aliases; added login request and logout storage assertions | IMPROVE |
| `tests/backend/unit/lamport.test.js` | Monotonic and workspace-isolated ordering clocks | Valid | KEEP |
| `tests/backend/unit/lockTable.test.js` | Claims, ownership, conflicts, batch rollback, concurrency, fencing, TTL, reads, waiters, paths, annotations | High-value; individual cases cover distinct lock lifecycle rules | KEEP |
| `tests/backend/unit/ot.test.js` | Operational-transform behavior | Valid | KEEP |
| `tests/backend/unit/paths.test.js` | Workspace and coordinator path resolution | Valid | KEEP |
| `tests/backend/unit/roomControl.test.js` | Room control payload and RPC behavior | Valid | KEEP |
| `tests/backend/unit/services.test.js` | Context, notices, workspace, patches, locks, Supabase lease renewal | Valid; uses a 1.75-second interval to verify real renewal | KEEP |
| `tests/backend/unit/sessionAuth.test.js` | Room socket session and membership authentication | Valid security coverage | KEEP |
| `tests/backend/unit/supabase.test.js` | Supabase adapter behavior | Valid with mocks; missing credentials only produce a warning | KEEP |
| `tests/backend/unit/transcripts.test.js` | Transcript discovery, parsing, and sync | Valid | KEEP |
| `tests/backend/unit/serverboard-authController.test.js` | Serverboard registration, login, OAuth, cookies and sessions | Valid with mocked auth provider | KEEP |
| `tests/backend/unit/serverboard-authMiddleware.test.js` | Bearer/cookie auth, profile provisioning, unauthorized requests | Valid authorization and failure coverage | KEEP |
| `tests/backend/unit/serverboard-env.test.js` | Environment aliases, defaults, secret validation, CORS | Valid; clones/restores `process.env` and reloads config modules | KEEP |
| `tests/backend/unit/serverboard-errorHandler.test.js` | Serverboard API error responses | Valid | KEEP |
| `tests/backend/unit/serverboard-inngestService.test.js` | Provisioning/teardown workers, Render and database failures | Valid with external-service mocks | KEEP |
| `tests/backend/unit/serverboard-projectController.test.js` | Project validation, authorization, status and deploy operations | Valid with mocked services | KEEP |
| `tests/backend/unit/serverboard-projectModel.test.js` | Project persistence and model behavior | Valid with mocked Supabase | KEEP |
| `tests/backend/unit/serverboard-renderService.test.js` | Render CLI request building, parsing and errors | Valid with mocked child processes | KEEP |
| `tests/backend/unit/serverboard-routes.test.js` | Health, route aliases, auth wiring, project and webhook endpoints | Valid HTTP integration on an ephemeral loopback port | KEEP |
| `tests/backend/unit/serverboard-supabase.test.js` | Supabase setup and missing-config behavior | Valid; no production credentials required | KEEP |
| `tests/backend/unit/serverboard-userModel.test.js` | User model reads and writes | Valid with mocked Supabase | KEEP |
| `tests/backend/unit/serverboard-webhookController.test.js` | Render webhook verification and event handling | Valid security and failure coverage | KEEP |
| `tests/backend/e2e/api.e2e.test.js` | Primary backend HTTP health, notices, lock status, claim and release | Valid API integration on an ephemeral loopback port | KEEP |
| `tests/backend/e2e/coordinator.e2e.test.js` | LockTable contention, waiter tracking, heartbeat, release and handover | Useful lifecycle sequence, though it calls LockTable directly | KEEP |
| `tests/backend/e2e/coordinator-server.e2e.test.js` | Coordinator bind address, HTTP claim conflict, malformed JSON, lease ownership, heartbeat and release | New HTTP coverage for loopback trust boundary | ADD |
| `tests/landing/unit/brain-animation.test.js` | Landing animation color and random-value helpers | Valid | KEEP |
| `tests/landing/unit/docs-highlighter.test.js` | Syntax highlighting and HTML escaping | Valid | KEEP |
| `tests/landing/e2e/docs-interactions.e2e.test.js` | Docs search, shortcuts, code decoration and copy interactions | Valid DOM-level integration | KEEP |
| `tests/landing/e2e/landing-interactions.e2e.test.js` | Menu, clipboard and live activity interactions | Valid DOM-level integration | KEEP |
| `tests/mission-control/unit/api.test.js` | API URL normalization | Valid | KEEP |
| `tests/mission-control/unit/panes.test.js` | Dashboard pane geometry and layout modes | Valid | KEEP |
| `tests/mission-control/unit/useLockGraph.test.js` | Agent identity and lock graph attribution | Valid | KEEP |
| `tests/mission-control/unit/utils.test.js` | Class-name helper behavior | Valid | KEEP |
| `tests/mission-control/e2e/fs-api.e2e.test.js` | Filesystem API route behavior and invalid paths | Valid with temporary directories | KEEP |
| `tests/mission-control/e2e/github-repos-api.e2e.test.js` | GitHub repository API response shaping | Valid handler-level integration | KEEP |

The former `test:node` path was not a working second framework. `tests/run.js` ran
Vitest-authored files using Node's test runner, but those files rely on Vitest globals;
`npm run test:node` failed with `ReferenceError: test is not defined`. The custom TypeScript
loader was referenced only by this runner. The obsolete script and its runner/loader files
were removed, leaving Vitest as the single supported test system.

## Security boundaries and remaining gaps

`CoordinatorRouter` itself does not authenticate HTTP requests. The production
`PortListener.listen` binds the coordinator to `127.0.0.1`; the new HTTP integration test
asserts that bind and exercises claim, conflict, heartbeat, and release ownership. This
is a local-process trust boundary, not room-membership authentication. Remote room
control uses the authenticated WebSocket path in `backend/websocket/sessionAuth.js` and
`controlServer.js`; the public HTTP server applies route-specific local/member checks.

In serverboard, project and GitHub routes use `requireAuth`, as does `/auth/me`.
Registration, login, logout, and OAuth entry/callback routes are intentionally public.
The Render webhook route has no user-session middleware; `WebhookController` verifies
its configured HMAC signature in production or when a webhook secret is configured.
Existing tests cover these route and controller boundaries.

The focused coordinator integration test does not yet exercise `/escalate`, `/presence`,
`/patch`, `/graph`, the SSE stream, or malformed-but-valid JSON payload shapes. The
lock-table unit suite covers fencing, expiration, renewal, and batch rollback; the main
remaining coordinator gap is integration coverage for those other operations and the
WebSocket authorization/rate-limit boundary. Coverage is not a quality target: the
pre-change full-suite run reported 34.67% statements overall, with production modules
outside the current test inventory still untested.

## CI checks

The workflow runs on pushes to `main`, pull requests targeting `main`, and manual dispatch.
Its checks are **Backend tests (Node 22.x)**, **Full suite (Node
20.x)**, and **Full suite (Node 22.x)**. A repository administrator can mark these three
status checks as required in branch protection or repository rules. This change does not
configure GitHub branch protection. The full-suite jobs include backend tests as well;
the focused backend job provides a distinct stable check for branch protection while the
full matrix continues to validate all suites on both supported Node.js versions.
