# Handoff: release v0.1.2

**Goal.** Ship the security fixes merged since the July release, and get npm/PyPI/Go metadata pointing at aktailtd.

**What changed.** Version bumped to 0.1.2 (patch: repository URL to aktailtd, OIDC trusted publishing; no API change).

**Decisions.** Repo history was rewritten on 2026-11-21 to remove personal author data; the originals are private `aktailtd/envello-migrate-archive`. Never push old history back.

**State.** PR open. After merge: tag `v0.1.2` on master. Publishing: tag push runs publish.yml (npm OIDC); needs npm trusted publisher aktailtd/envello-migrate, publish.yml.

**Verify.** pnpm test: 7 passed. After tagging, check the Actions run and the registry page shows 0.1.2 with repository aktailtd/envello-migrate.

**Gotchas.** The July releases were published with tokens (no provenance); this is the first trusted-publishing release, so a failed publish most likely means the trusted publisher isn't configured yet. Re-run the workflow after fixing, no new tag needed.
