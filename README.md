# Manual acceptance action

Validate the recorded manual acceptance checklist on a pull request. The agent writes observable checks as unchecked items; a human performs them and marks them complete.

**A passing check does not prove a human performed a test.** An exemption also passes, with `status=exempt` and `enforced=false`; it never reports checklist completion.

Extracted from [Counterfact's workflow](https://github.com/counterfact/api-simulator/blob/440eab4949f18375cabd58148d605e689574e22a/.github/workflows/manual-acceptance-tests.yaml), including [PR #2566's explicit label bypass](https://github.com/counterfact/api-simulator/pull/2566). See [NOTICE.md](NOTICE.md) for provenance and attribution. This repository provides the reusable Action; the existing [manual-acceptance-tests guide](https://github.com/pmcelhaney/manual-acceptance-tests) describes the broader review practice.

## Install

Add `.github/workflows/manual-acceptance-tests.yml` to your repository:

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
      - uses: pmcelhaney/manual-acceptance-action@08bdaba55cdac0b7738b2c1652d944e8404c55cf
        id: acceptance
```

The example pins the initial implementation commit. Review a new full commit SHA before upgrading. There is no release tag yet. Keep this workflow on the default/base branch. No checkout, install, token, API request, or secret is needed. The Action is dependency-free JavaScript using GitHub's Node 24 runtime; self-hosted runners need Node 24 Action support (runner 2.327.1 or newer).

The metadata-only `pull_request_target` workflow supports forks and runs the trusted base workflow when a PR body or label changes. **Never add checkout of the PR head, execute PR code, interpolate PR text into a script, or restore PR-controlled caches in this job.** Keep `permissions: {}`. The Action itself only reads event JSON and writes fixed status values and counts. See GitHub's [pull_request_target security guidance](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target).

`pull_request` is also supported with the same activity types and permissions, but uses the PR workflow context, can require approval for forks, and does not run on conflicted PRs. `edited` handles checkbox edits and base retargeting; `synchronize` handles PR branch updates, including updates incorporating base changes. A base-branch push alone does not refresh every open PR. This Action does not assess code changes, reset completed boxes, or prove that tests remain valid after base/head changes. A human must clear and repeat affected checks. Do not combine both PR event families for the same required job.

When using a merge queue, retain `merge_group`. Like the source, this reports `status=merge-group` and success, relying on validation before queue admission. It does not inspect the combined commit or fetch constituent PRs. Reconsider this policy if your queue requires fresh acceptance after combination. See [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).

After adoption, verify failing and passing PR cases, then configure `Validate manual acceptance tests` as a required status check yourself. This repository does not change branch rules or install anything in Counterfact.

## Default behavior

- Exact labels `design` or `skip-manual-acceptance-tests` bypass validation. Removing the label reruns enforcement through `unlabeled`.
- Otherwise, a case-sensitive branch prefix `copilot`, or a case-insensitive occurrence of `## Manual acceptance tests` anywhere in the body, activates validation. Ordinary PRs with neither pass as `out-of-scope`.
- Validation requires a matching level-two section, at least one checked `- [x] description` item (uppercase `X` also works), and no unchecked `- [ ] description` items in that section. The section ends at the next level-two heading.
- The configured event payload is evaluated on every run. No historical result is cached. Re-run the latest event rather than an obsolete event when reviewing current state; concurrency cancellation reduces overlapping old runs but is not a transaction with PR edits.

Example PR description, initially written by the agent:

```markdown
## Manual acceptance tests

Setup: run the PR build with the sample configuration.

- [ ] Open the search page, search for an existing title, and confirm its detail link opens the expected record.
- [ ] Search for an unknown title and confirm the empty-state message appears.
```

Only the human acceptance owner changes these boxes to `[x]` after observing the results. Agents must not check them based on automated tests.

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

## Parser compatibility and limits

This is the source workflow's small text validator, not a Markdown parser. Only hyphen bullets are recognized; `*` and numbered lists are unsupported. The first matching section is used. Fenced examples and HTML comments are not stripped, so checkbox-like text there can count. Text that resembles a heading can activate enforcement even when section validation fails. Use a single plainly written section and simple `- [ ]` items with descriptions. Do not rely on this check to defend against an author forging evidence of human testing. Automated tests deliberately cover these source limitations as well as hostile input execution attempts.

Defaults retain the source's branch, heading, labels, counts and merge-queue policies. CRLF/CR line endings are normalized, and malformed events/configuration fail closed. No repository names, paths, secrets, PR scripts or historical source repository commits are required by the runtime.

## Develop

Use Node 24 or newer. There are no install/build steps or dependencies:

```sh
npm run lint
npm test
```

Tests cover enforcement, exact exemptions/removal, checklist edits, section boundaries, source parser limitations, untrusted strings, outputs and consumer entrypoint execution. CI runs on Linux, Windows and macOS. A consumer smoke job verifies that native `uses: ./` invocation rejects unsupported CI events, then invokes the entrypoint with a synthetic PR event and checks its runner outputs. GitHub's reserved event variables cannot be replaced through step `env`, so the fixture invocation sets them in its child process. Synthetic checked items are integration fixtures, not human acceptance claims. Live fork/merge-queue event delivery requires adoption in a consumer repository; it is not exercised by this synthetic test.
