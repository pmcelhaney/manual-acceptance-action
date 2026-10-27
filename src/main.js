import { appendFileSync, readFileSync } from 'node:fs';
import { evaluate } from './checklist.js';

const input = name => process.env['INPUT_' + name.toUpperCase().replaceAll(' ', '_')];
const lines = (value, defaults) => value === undefined ? defaults : value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);

try {
  const requireAll = input('require-all') ?? 'false';
  if (!['true', 'false'].includes(requireAll)) throw new Error('require-all must be true or false.');
  const result = evaluate(process.env.GITHUB_EVENT_NAME,
    JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), {
      heading: input('section-heading') ?? 'Manual acceptance tests',
      branchPrefixes: lines(input('branch-prefixes'), ['copilot']),
      skipLabels: lines(input('skip-labels'), ['design', 'skip-manual-acceptance-tests']),
      requireAll: requireAll === 'true',
    });
  // Only fixed status names, booleans and integers leave the untrusted-data
  // boundary. Never print PR text or label names as runner commands.
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result)
    .map(([key, value]) => `${key}=${value}\n`).join(''));
  const messages = {
    complete: 'Recorded checklist is complete; human execution is not verified.',
    incomplete: 'Checklist required: include the configured level-two section, at least one checked item, and no unchecked items.',
    exempt: 'Validation bypassed by an exact exemption label; this does not establish acceptance completion.',
    'out-of-scope': 'No matching branch prefix or section; checklist validation is not required.',
    'merge-group': 'Merge-group success relies on PR validation before queue admission; combined changes are not revalidated.',
  };
  console.log(`${messages[result.status]} Checked: ${result.checked}; unchecked: ${result.unchecked}.`);
  if (result.status === 'incomplete') process.exitCode = 1;
} catch {
  // Do not echo parser errors containing untrusted event content.
  console.error('Manual acceptance action failed: invalid event, configuration, or runner output file.');
  process.exitCode = 1;
}
