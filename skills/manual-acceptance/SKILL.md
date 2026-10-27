---
name: manual-acceptance
description: Prepare concrete human acceptance steps for a pull request that changes observable behavior, or revise an existing acceptance checklist after code changes. Use for acceptance-test drafting, not automated test results or claims that a human has tested the change.
---

# Manual acceptance

Give the reviewer a short path from the change to something they can observe. Read the diff, relevant product behavior, existing PR description, and repository instructions before drafting. Inspect the installed manual-acceptance Action configuration for a custom heading or exemption policy.

## Write the checks

Use one `## Manual acceptance tests` section unless the consuming workflow configures a different `section-heading`. Put a small set of meaningful checks directly under it, before the next level-two heading. Use hyphen task items with descriptions: `- [ ] ...`. Do not put the real checklist inside a code fence or HTML comment; the Action is a text validator and can count examples there.

Give the human enough setup to reproduce the behavior: the relevant build or artifact, starting state, commands or URLs, sample inputs, and expected observable results. Include a success path and a relevant failure, edge, or regression case when they apply. Prefer a few useful checks to a quota. Verify that supplied commands and fixtures exist; identify any prerequisites you cannot verify.

For example, after a search change:

## Manual acceptance tests

Setup: use the PR preview with the sample catalog containing “The Hobbit.”

- [ ] Search for “Hobbit.” Confirm “The Hobbit” appears and its link opens that book's detail page.
- [ ] Search for “zzzz-no-book.” Confirm the empty-state message appears without an error page.

Tailor this example to the actual change. “Updated the handler,” “tests pass,” and “looks good” are not observable acceptance steps. Keep automated verification commands and their results in a separate PR section.

## Preserve human ownership

Leave new checks unchecked. Do not check boxes because you inspected code, ran commands, or passed automated tests. A human performs the checks and records completion. If updating a description, preserve completed boxes; when new changes may invalidate one, flag that specific check for the human to clear and repeat. Do not silently claim retesting.

The Action requires at least one checked item and no unchecked items in the selected section when enforcement applies. Passing shows the recorded checklist state, not who tested it, its quality, or whether the behavior is correct. A passing exemption is not completed acceptance.

For changes with no observable behavior, explain that fact and follow the repository's established policy. Do not add exemption labels, change branch names to escape enforcement, weaken the workflow, or mark anything complete to make CI green. Ask the maintainer to decide an exemption when needed; this skill grants no permission to publish PR edits, change protection rules, secrets, permissions, or merge.
