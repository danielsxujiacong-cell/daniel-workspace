# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.3.1, repair AI next-step GitHub commit context and recommendation grounding.
- **Data baseline:** After the user-confirmed V3.2 cleanup, private Workspace retains 26 real projects and 5 pinned projects. This step changes no Workspace records or Supabase schema/sync code.
- **Implementation:** Uses the existing GLM Worker and bounded project description/status/stage/current next step, associated task summaries, and a verified public GitHub latest commit. Generated and edited text stays in page memory; explicit adoption changes `project.next` through existing `persist()` and sync serialization. Guest mode does not load this module.
- **Root cause:** GitHub API snapshots keep a seven-character `latestCommit.sha` for display but build `latestCommit.url` with the full SHA. The recommendation context verifier required the URL to end exactly at the short SHA, so it discarded every valid latest commit although project detail rendered it.
- **Fix and verification:** The verifier now checks that the URL is the same public repository and its full SHA starts with the stored short SHA. The prompt now requires a concrete follow-up to the latest commit, linked to the project description and most relevant open task; incomplete sources stop generation with explicit missing-source feedback. Seven targeted test files pass 38/38. The HTTP integration test stubs the model endpoint and verifies project description, Commit summary/time, and tasks reach the configured `glm-4-flash-250414` request; live `/health` reports `configured: true`. No paid live completion request, Supabase write, schema change, sync change, or layout change was made. Production UI acceptance remains pending deployment.

## Next action

After V3.3.1 assets are deployed, sign in at the existing Workspace production entry and open a project with a visible latest GitHub commit and related open task. Generate a suggestion and confirm it names the recent feature, includes a concrete verifiable action, and cites the actual commit/time and relevant task. Inspect the browser Network request to `/api/chat` to confirm `currentPage: project-next-step` and `relevantContext.projectNextStep` contain the project description, commit summary/time, and task; the response should come from the real Worker model. Then check a project missing a source and confirm the feature names the missing data without falling back to generic output. No adoption or Supabase data change is needed to validate this prompt fix.
