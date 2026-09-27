# Project instructions

## Orientation

- Read `README.md`, `docs/PROJECT_CONTEXT.md`, and `docs/HANDOFF.md` before modifying the project.
- Keep V1 small: vanilla HTML/CSS/JavaScript, no build step, no external API, backend, auth, RAG, or machine-wide scanning.
- Keep all user data in the `daniel-workspace-v1` localStorage key. Any future storage/API integration belongs behind `src/store.js`.

## Efficient execution

- Make focused changes and verify the affected interaction in a browser when it materially changes behavior.
- Escape user-provided strings before rendering HTML. Validate external links to HTTP or HTTPS.
- Update README when V1 user-facing behavior changes and HANDOFF when work remains. Record user-visible milestones in CHANGELOG.

## Git and delivery

- This repository is the source of truth across computers. Inspect Git status first; when clean, synchronize safely before editing.
- Review `.gitignore` and staged content before commit. Never commit secrets, browser state, local data, caches, or machine-specific configuration.
- Use a descriptive commit and push to the configured private GitHub remote for handoff.

## Project commands

- Start local preview: `python -m http.server 4174 --bind 127.0.0.1`
- Open: `http://localhost:4174`
- No package install or build step is required.
