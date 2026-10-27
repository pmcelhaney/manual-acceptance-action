# Manual acceptance action

The tests are green. The pull request looks reasonable. But has anyone actually tried the thing it changes?

Automated tests tell you whether the checks you wrote passed. They can still miss a confusing screen, a broken real-world workflow, or a misunderstanding of what the feature was meant to do. This matters especially when a coding assistant can produce more code than a person can comfortably review line by line.

A short manual acceptance checklist gives the reviewer something concrete to try. The author describes what should work; a human tries it and checks the boxes. This GitHub Action keeps that checklist from being forgotten before merge.

**The assistant writes the checks. A human performs them.** The Action reads the PR description and fails when a required checklist is missing or unfinished. It cannot tell who checked a box, whether they actually did the test, or whether the checks cover the right behavior. Those remain review decisions.

## What review looks like

Instead of “search works; tests pass,” a PR might say:

```markdown
## Manual acceptance tests

Setup: open the PR preview with the sample catalog containing “The Hobbit.”

- [ ] Search for “Hobbit.” Confirm “The Hobbit” appears and its link opens that book's detail page.
- [ ] Search for “zzzz-no-book.” Confirm the empty-state message appears without an error page.
```

While either box is empty, the check fails. After a reviewer performs both checks and changes them to `[x]`, editing the PR description reruns the check and it passes. That gives the author and reviewer a shared account of what they expect the change to do.

If a later commit changes search behavior, the human needs to clear and repeat the affected checks. Rerunning CI does not reset boxes or establish that the previous testing still applies.

## Quick start

You need two pieces: the workflow that checks PR descriptions, and the bundled skill that teaches your coding assistant to write useful checklists. A skill is a small instruction file your assistant can load when preparing a PR.

The easiest route is to copy the setup prompt below into your coding assistant while working in the repository you want to adopt this in. It asks for a reviewable change; you decide when to merge it and whether to require the check.

### Copy this setup prompt

Replace `<LOCAL_REPOSITORY_PATH>` with the repository you want to set up. No tokens, secrets, or organization placeholders are needed.

```text
Set up human-owned manual acceptance checklists in the repository at
<LOCAL_REPOSITORY_PATH>. Prepare the changes on a focused branch for my review.

First read the repository's instructions, existing skills, PR template and
GitHub Actions workflows. Preserve existing CI and human-completed checklist
items. If a manual acceptance check or skill already exists, reconcile it
instead of creating a duplicate or overwriting it. Do not discard local work.

Use https://github.com/pmcelhaney/manual-acceptance-action at the immutable
setup revision eba11d493c9276cd12213aa8cf990ffe0a62cca1. Inspect these text files
at that revision before installing them:
- skills/manual-acceptance/SKILL.md
- examples/manual-acceptance-tests.yml
Fetch them through GitHub's raw/contents endpoint or a temporary checkout;
do not execute downloaded code or install this repository's development tools.

Copy the skill into .agents/skills/manual-acceptance/SKILL.md in this project.
This project skills path is supported by Codex and GitHub Copilot. For another
assistant, verify its documented project skills location before adapting the
path. Do not install a global/personal skill or touch unrelated repositories.
Read the installed skill and use it when drafting acceptance steps. Add a brief
pointer in the repository's existing coding instructions so contributors know
to use it for PRs that change observable behavior; preserve existing guidance.

Adapt the pinned workflow example into
.github/workflows/manual-acceptance-tests.yml, or reconcile the existing check.
Keep its full Action commit pin
7b624f1bc89238a5d7e762255cce95dc3daf8f5a and stable job name
"Validate manual acceptance tests". The default requires a checklist for
copilot-prefixed branches or PRs containing "## Manual acceptance tests".
Explain that scope, and adapt branch-prefixes only to an established local
convention; flag any decision that needs my judgment. Do not silently require
all PRs or exempt a class of PRs.

Keep permissions: {} and the metadata-only pull_request_target job. It must
never check out or run PR code, interpolate PR text into scripts, restore
PR-controlled caches, or receive secrets. Retain opened, edited, synchronize,
reopened, labeled and unlabeled events. Retain merge_group/checks_requested:
that event passes based on pre-queue PR validation, without retesting combined
changes. Explain this limitation if the repo uses a merge queue.

Keep the exact design and skip-manual-acceptance-tests exemption semantics
unless I explicitly choose otherwise. Explain that removing all matching exemption labels restores normal
enforcement, and that an exempt pass is not completed testing.
Never add bypass labels, check human acceptance boxes, enable auto-merge, or
weaken existing checks to get a green result.

Use the exact heading and hyphen checkbox format expected by the Action.
Add a reminder to the existing PR template where appropriate; avoid adding the
actual heading to every PR unless that opt-in behavior is intended. Agents
write concrete unchecked steps with setup and expected observations; humans
perform them. Report automated results separately.

Verify the installed skill file, workflow syntax, pin, event coverage and
least privileges. Use a temporary synthetic consumer fixture to show a required
unchecked checklist fails, a checked fixture passes, an exact exemption is
reported as exempt, and removing it restores failure. Synthetic checked boxes
are test fixtures, never evidence of human acceptance. Run the repo's relevant
checks. Show me the diff, validation results and a checklist for trying this
on a real disposable PR after adoption. Do not publish/merge the changes,
change branch protection, secrets, permissions or repository settings. Explain
how I can choose to require the check after I have seen it run successfully.
```

### Set it up yourself

Add this workflow as `.github/workflows/manual-acceptance-tests.yml`, checking for an existing acceptance workflow first:

```yaml
name: Manual acceptance tests
on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened, labeled, unlabeled]
  merge_group:
    types: [checks_requested]
permissions: {}
concurrency:
  group: manual-acceptance-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
jobs:
  manual-acceptance-tests:
    name: Validate manual acceptance tests
    runs-on: ubuntu-latest
    steps:
      - uses: pmcelhaney/manual-acceptance-action@7b624f1bc89238a5d7e762255cce95dc3daf8f5a
        id: acceptance
```

The example pins a tested implementation commit. It needs no checkout, installation step, token, API call, or secret. Keep this job limited to PR metadata: never run the PR's code in it. See GitHub's [guidance for using pull_request_target safely](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).

Install the [bundled skill](skills/manual-acceptance/SKILL.md) from your target repository's root with this POSIX shell snippet (requires `curl`). It refuses to replace an existing skill:

```sh
set -eu
skill_revision=eba11d493c9276cd12213aa8cf990ffe0a62cca1
skill_destination=.agents/skills/manual-acceptance
if [ -e "$skill_destination" ]; then
  echo "A manual-acceptance skill already exists; review it before updating." >&2
  exit 1
fi
skill_download=$(mktemp)
trap 'rm -f "$skill_download"' EXIT
curl --fail --silent --show-error --location \
  "https://raw.githubusercontent.com/pmcelhaney/manual-acceptance-action/$skill_revision/skills/manual-acceptance/SKILL.md" \
  --output "$skill_download"
mkdir -p .agents/skills
mkdir "$skill_destination"
cp "$skill_download" "$skill_destination/SKILL.md"
```

Commit the workflow and skill together. `.agents/skills/manual-acceptance/SKILL.md` is a project skills location supported by [Codex](https://developers.openai.com/codex/build-skills) and [GitHub Copilot](https://docs.github.com/en/copilot/reference/customization-cheat-sheet). Other assistants may need a different documented path. This does not install anything globally.

Ask your assistant to “Use the manual-acceptance skill to draft the acceptance steps for this change.” Add a pointer to that skill in your existing coding instructions if you want it used routinely. If your assistant does not discover it, start a new session and check that it can read the installed file. Keep new checks unchecked. Avoid putting a real acceptance heading in a generic PR template unless you want every PR using that template to opt in.

After merging the setup, try a disposable PR: confirm that an unchecked item fails, have a human perform and check it, then confirm that clearing it fails again. Check label removal too. Only then, if you want it to block merging, choose `Validate manual acceptance tests` as a required status check in your branch rules. This setup never changes those settings for you.

## Which PRs are checked?

By default, the check applies when the branch starts with `copilot` (case-sensitive) or the PR description contains `## Manual acceptance tests` (case-insensitive). It requires at least one checked hyphen item and no unchecked items in that section. Other PRs pass as out of scope. Configure branch prefixes to fit your team, or use `require-all: 'true'` if you choose to require checklists more broadly.

The exact labels `design` and `skip-manual-acceptance-tests` bypass validation. Removing all matching exemption labels reruns normal enforcement. A bypass reports `status=exempt`, not completion; reserve it for a deliberate reviewer decision. The Action does not control who can add labels.

## Event behavior and fork safety

The example uses `pull_request_target` so body and label edits on fork PRs run the trusted base workflow. Keep `permissions: {}` and do not add PR checkout, PR code execution, PR-controlled caches, secrets, or PR text interpolation to this job. The Action reads event JSON and prints fixed messages and counts.

`edited` handles checkbox edits and base retargeting. `synchronize` handles PR branch updates, including updates incorporating base changes. A base-branch push alone does not refresh every open PR. The Action evaluates the event snapshot, so rerun the latest event rather than an old one. Cancellation reduces overlapping runs but is not a transaction with edits.

`pull_request` is also supported with the same activity types, but uses the PR workflow context, can require approval for forks, and does not run on conflicted PRs. Use one PR event family for this job.

For a merge queue, the included `merge_group` event reports success based on validation before queue admission. It does not inspect constituent PRs or repeat acceptance against the combined commit. Decide whether that policy fits your queue. See [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

The Action uses GitHub's Node 24 runtime. Self-hosted runners need Node 24 Action support (runner 2.327.1 or newer). There is no release tag yet; review a full commit SHA when upgrading.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `section-heading` | `Manual acceptance tests` | Literal heading text without `##`; one nonempty line. Case-insensitive matching. |
| `branch-prefixes` | `copilot` | Newline-separated, case-sensitive literal prefixes. Empty disables branch enforcement. No glob or regex evaluation. |
| `skip-labels` | `design` and `skip-manual-acceptance-tests` | Newline-separated exact, case-sensitive labels. Empty disables exemptions. |
| `require-all` | `false` | `true` requires every PR to have a checklist, except explicitly exempt PRs. Only `true` or `false` is accepted. |

For example, add this beneath the `uses` step:

```yaml
        with:
          branch-prefixes: |
            copilot
            codex/
          skip-labels: |
            design
            skip-manual-acceptance-tests
```

The Action does not restrict who can apply labels; repository permissions and reviewer policy own that decision. Prefix-only enforcement can be avoided by an author choosing another branch without a heading. Use `require-all: 'true'` and, if appropriate, `skip-labels: ''` for broader enforcement.

## Outputs and failures

| Output | Values |
| --- | --- |
| `status` | `complete`, `incomplete`, `exempt`, `out-of-scope`, `merge-group` |
| `enforced` | `true` for complete/incomplete; otherwise `false` |
| `checked` / `unchecked` | Matched item counts; `0` when skipped or section missing |

`incomplete` exits with code 1 after writing outputs. Other statuses exit 0. Unsupported events, malformed payloads, invalid configuration, and runner file failures exit 1; outputs are not guaranteed for operational errors. Use a subsequent step with `if: always()` if you need to inspect outputs after a validation failure. The Action prints only fixed messages and numeric counts, never PR text or label names.

## Parser limits

This is the source workflow's small text validator, not a Markdown parser. Only hyphen bullets are recognized; `*` and numbered lists are unsupported. The first matching section is used. Fenced examples and HTML comments are not stripped, so checkbox-like text there can count. Text that resembles a heading can activate enforcement even when section validation fails. Use a single plainly written section and simple `- [ ]` items with descriptions. Do not rely on this check to defend against an author forging evidence of human testing. Automated tests deliberately cover these source limitations as well as hostile input execution attempts.

Defaults retain the source's branch, heading, labels, counts and merge-queue policies. CRLF/CR line endings are normalized, and malformed events/configuration fail closed. No repository names, paths, secrets, PR scripts or historical source repository commits are required by the runtime.

## Development

Use Node 24 or newer. There are no install/build steps or dependencies:

```sh
npm run lint
npm test
```

Tests cover enforcement, exact exemptions/removal, checklist edits, section boundaries, source parser limitations, untrusted strings, outputs and consumer entrypoint execution. CI runs on Linux, Windows and macOS. A consumer smoke job verifies that native `uses: ./` invocation rejects unsupported CI events, then invokes the entrypoint with a synthetic PR event and checks its runner outputs. GitHub's reserved event variables cannot be replaced through step `env`, so the fixture invocation sets them in its child process. Synthetic checked items are integration fixtures, not human acceptance claims. Live fork/merge-queue event delivery requires adoption in a consumer repository; it is not exercised by this synthetic test.

## Background

This Action grew out of [Counterfact's workflow](https://github.com/counterfact/api-simulator/blob/440eab4949f18375cabd58148d605e689574e22a/.github/workflows/manual-acceptance-tests.yaml), including its explicit skip label. See [NOTICE.md](NOTICE.md) for attribution and the [manual-acceptance-tests guide](https://github.com/pmcelhaney/manual-acceptance-tests) for more about the review practice.
