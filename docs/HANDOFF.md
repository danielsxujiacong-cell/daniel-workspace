# Handoff

## Current state

- **Updated:** 2026-10-11
- **Stage:** V3.4.2 AI daily brief timeout repair.
- **Diagnosis:** Live `/health` is configured and a synthetic end-to-end brief returned from the deployed GLM Worker in about 11 seconds. Source inspection found duplicate brief context in the message and context fields, a 1,200-token global output budget, a 20-second GLM attempt with one retry (up to about 40 seconds), and the browser clearing its timeout before consuming the response body.
- **Fix:** The brief sends context once, limits recent commit input and output size, allows 25 seconds per GLM attempt with only one safe retry, and applies a 60-second frontend timeout through full JSON body parsing. Worker errors remain visible and retryable. Other AI pages keep their original token and upstream timeout limits.
- **Verification:** Targeted timeout and daily brief tests pass; syntax and diff checks pass. No Supabase or layout changes.

## Next action

Deploy the Worker, verify `/health` and a synthetic daily brief request, then test Home with a signed-in session. Confirm normal completion, actionable timeout/error details, and successful manual retry without fabricated content.