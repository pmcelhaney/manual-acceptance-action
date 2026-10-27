// Extracted from Counterfact's MIT-licensed manual-acceptance-tests workflow.
// Copyright (c) 2022 Patrick McElhaney. See LICENSE and NOTICE.md.

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function evaluate(eventName, event, options = {}) {
  const result = (status, enforced = false, checked = 0, unchecked = 0) => ({
    status, enforced, checked, unchecked,
  });
  if (eventName === 'merge_group') return result('merge-group');
  if (!['pull_request', 'pull_request_target'].includes(eventName)) {
    throw new Error('Expected pull_request, pull_request_target, or merge_group event.');
  }
  const pr = event.pull_request;
  if (!pr || typeof pr.head?.ref !== 'string' || !Array.isArray(pr.labels)
      || !(pr.body === null || typeof pr.body === 'string')
      || !pr.labels.every(label => typeof label?.name === 'string')) {
    throw new Error('Invalid pull-request event payload.');
  }
  const heading = options.heading ?? 'Manual acceptance tests';
  if (!heading.trim() || /[\r\n]/.test(heading)) throw new Error('section-heading must be one nonempty line.');
  const skipLabels = options.skipLabels ?? ['design', 'skip-manual-acceptance-tests'];
  if (pr.labels.some(label => skipLabels.includes(label.name))) return result('exempt');
  const body = (pr.body ?? '').replace(/\r\n?/g, '\n');
  // Preserve the source's broad, case-insensitive opt-in detection: a malformed
  // heading still activates enforcement and then fails section validation.
  const optedIn = body.toLowerCase().includes('## ' + heading.toLowerCase());
  const branchMatch = (options.branchPrefixes ?? ['copilot']).some(prefix => pr.head.ref.startsWith(prefix));
  if (!options.requireAll && !branchMatch && !optedIn) return result('out-of-scope');
  const section = new RegExp('^##\\s*' + escape(heading) + '\\s*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))', 'im').exec(body)?.[1];
  if (section === undefined) return result('incomplete', true);
  // Deliberately retain the source's text-validator semantics. This is not a
  // Markdown renderer or a claim that a human performed the checks.
  const checked = [...section.matchAll(/^\s*-\s\[x\]\s+.+$/gim)].length;
  const unchecked = [...section.matchAll(/^\s*-\s\[\s\]\s+.+$/gm)].length;
  return result(checked > 0 && unchecked === 0 ? 'complete' : 'incomplete', true, checked, unchecked);
}
