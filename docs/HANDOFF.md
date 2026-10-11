# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.4 Step 1 AI daily brief, implemented locally.
- **Behavior:** Home now generates a three-part brief only after the user clicks. It first refreshes public GitHub snapshots for pinned projects, then sends at most five projects' verified latest commit, status, and confirmed next step to the existing real GLM Worker.
- **Output boundary:** Recent work, up to three actionable recommendations, and issues to watch. Every item must name a pinned project and include its evidence. Unsupported entries are omitted and shown as insufficient data. Invalid responses and API failures are visible and retryable. No Mock fallback or project/task writes.
- **Verification:** Targeted checks passed 24/24, including guest/login gate, AI context and brief parsing; app and module syntax checks pass; `git diff --check` passes. No Supabase tables, sync code, or Worker contract changed.

## Next action

After push and deployment, sign in and open Home. Click「生成简报」; verify project attribution and evidence against the freshly read commits, status, and confirmed next step. Confirm three sections on mobile, missing data is explicit, retry works after API failure, and Projects/Tasks remain unchanged.