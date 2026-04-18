# AGENTS.md

Playbook for coding agents (and humans) maintaining `lean-statusline`. Focused on release mechanics — the README covers what the tool does; this covers how to ship changes without breaking the trust chain.

## Repo shape

- **Runtime**: Node ≥ 20. Zero deps. ESM only (`"type": "module"`).
- **Source**: `bin/lean-statusline.mjs` (entry) + `lib/*.mjs` (segment registry, config, wizard TUI, install/doctor helpers, rate-limit cache).
- **Published**: npm as [`lean-statusline`](https://www.npmjs.com/package/lean-statusline). Unscoped, public access.
- **Git remote**: `git@github.com:yigitkonur/lean-statusline.git` (SSH, private repo at time of writing).
- **Author identity**: `Yigit Konur <9989650+yigitkonur@users.noreply.github.com>` — already set in `~/.gitconfig` globally. Never pass `-c user.email=…` overrides; plain `git commit` is correct.

## Conventional commits (required)

Every commit subject must follow `type(scope): imperative summary`. Enforced by convention, not by a hook — but please respect it.

- **type**: `feat` / `fix` / `docs` / `refactor` / `test` / `chore` / `perf`.
- **scope**: short hyphenated descriptor of what was touched — `install-cmd`, `wizard-tui`, `npx-detect`, `rate-segments`, `ui-polish`. Not `feat`, not `fix` alone.
- **subject**: under 50 chars, imperative, no vague words (`WIP`, `misc`). One commit, one purpose.
- **body** (optional): explains _why_, not _what_. Bullet points for multi-part changes.

Examples from the git log: `feat(wizard-tui): paginate into 5 steps for screen fit`, `fix(npx-detect): use npm_lifecycle_event + npm_command, not user-agent`.

## Versioning

Semver. In `1.x.y`:

| Bump | When                                                                                       |
|------|--------------------------------------------------------------------------------------------|
| `x`  | Breaking change to the stable surface listed in `CHANGELOG.md#1.0.0` — _avoid until 2.0_.  |
| `y.0`| New feature, new segment, new CLI flag, new config key. Backwards compatible.              |
| `y`  | Bug fix, internal refactor, docs, perf. No user-visible change to config or CLI surface.   |

When in doubt, patch. Minor bumps should be justified by something a user can observe.

## Release procedure

Run from repo root, on `main`, with a clean working tree.

### 1. Prepare

```bash
# Sanity: no uncommitted work
git status --short   # must be empty

# All tests pass (such as they are)
node -e "import('./lib/wizard.mjs').then(() => console.log('loads'))"
echo '{"model":{"display_name":"test"},"context_window":{"context_window_size":200000,"used_percentage":5},"cwd":"/tmp"}' | node bin/lean-statusline.mjs
node bin/lean-statusline.mjs doctor
```

### 2. Bump version + update CHANGELOG

```bash
# 1. Bump package.json (no tag yet — we tag after the commit)
npm version <patch|minor|major> --no-git-tag-version

# 2. Move the "[Unreleased]" section to a new "[X.Y.Z] — YYYY-MM-DD" heading
#    in CHANGELOG.md. Add a new empty [Unreleased] above it. Append a
#    compare link at the bottom.
$EDITOR CHANGELOG.md
```

CHANGELOG headings use these section names (Keep a Changelog):

- `### Added` — new features.
- `### Changed` — changes to existing behavior.
- `### Deprecated` — soon-to-be-removed features.
- `### Removed` — features removed this release.
- `### Fixed` — bug fixes.
- `### Security` — security-relevant changes (CVE, credential handling, etc.).

Skip sections that don't apply.

### 3. Commit + tag

```bash
git add package.json CHANGELOG.md <other files>
git commit -m "chore(release): v<X.Y.Z>

See CHANGELOG.md for details."
git tag -a v<X.Y.Z> -m "v<X.Y.Z>"
git push && git push --tags
```

### 4. Publish to npm

npm token is not stored in this repo. Supply it inline only for the publish, then scrub:

```bash
# Back up existing npmrc (if any), inject token, publish, restore.
cp ~/.npmrc ~/.npmrc.pre-publish.bak 2>/dev/null
printf "//registry.npmjs.org/:_authToken=%s\n" "$NPM_TOKEN" >> ~/.npmrc
npm publish
[ -f ~/.npmrc.pre-publish.bak ] && mv ~/.npmrc.pre-publish.bak ~/.npmrc || rm ~/.npmrc

# Verify no token leaked to disk:
grep -q "$NPM_TOKEN" ~/.npmrc 2>/dev/null && echo "!! LEAK !!" || echo "clean"

# Wait for registry propagation (npx prefers-offline cache can serve stale):
until npm view lean-statusline@<X.Y.Z> version >/dev/null 2>&1; do sleep 3; done
```

### 5. Create the GitHub release

Use `gh release create` to attach release notes. Pull the notes straight from CHANGELOG.md's new section:

```bash
# Extract the new section body (everything between the new heading and the next one):
awk '/^## \['<X.Y.Z>'\]/{flag=1; next} /^## \[/{flag=0} flag' CHANGELOG.md > /tmp/release-notes.md

gh release create v<X.Y.Z> \
  --title "v<X.Y.Z>" \
  --notes-file /tmp/release-notes.md \
  --verify-tag

rm /tmp/release-notes.md
```

If the release is a `major` or `minor`, pass `--latest`. Patches default to latest already.

Security rule: `gh release create` uses your existing `gh auth` token. If it lacks scope, `gh auth refresh -h github.com -s repo` fills it in.

### 6. Update the global install (optional, for the maintainer's own box)

```bash
npm install -g lean-statusline@<X.Y.Z>
lean-statusline version    # confirm
```

This is also the gate against npm's `npx @latest` stale-delegation bug — if you run `npx -y lean-statusline@latest <cmd>` and you have an older version globally installed, npx silently delegates to the stale global. Keep global current.

## Quick `gh release` retrofit for existing tags

For tags that shipped before releases were instituted, you can backfill:

```bash
for tag in $(git tag -l 'v*' | sort -V); do
  ver="${tag#v}"
  # Skip if a release already exists for this tag
  gh release view "$tag" >/dev/null 2>&1 && continue
  notes=$(awk '/^## \['"$ver"'\]/{flag=1; next} /^## \[/{flag=0} flag' CHANGELOG.md)
  [ -z "$notes" ] && notes="See CHANGELOG.md"
  gh release create "$tag" --title "$tag" --notes "$notes"
done
```

## Never do these

- Never amend an already-pushed commit or tag. New releases are new commits.
- Never `npm unpublish` a version that's been live more than 72h — use a patch release with a deprecation note instead.
- Never put the npm token in any file that gets committed. Use the `.npmrc` pattern above and scrub it.
- Never bump version in `package.json` without a matching `CHANGELOG.md` entry in the same commit.
- Never break the config schema committed in `CHANGELOG.md#1.0.0` without a major-version bump.
- Never use `-c user.email=…` when committing. The global `~/.gitconfig` has the right identity.

## Repo facts, handy

- npm: <https://www.npmjs.com/package/lean-statusline>
- GitHub: <https://github.com/yigitkonur/lean-statusline>
- License: MIT
- Entry point: `bin/lean-statusline.mjs`
- Config file: `~/.claude/lean-statusline.json`
- Claude Code settings path: `~/.claude/settings.json` (under `.statusLine`)
