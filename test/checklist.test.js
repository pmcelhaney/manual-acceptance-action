import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/checklist.js';

const body = items => '## Manual acceptance tests\n' + items;
const event = (text = null, branch = 'feature/example', labels = []) => ({
  pull_request: { body: text, head: { ref: branch }, labels: labels.map(name => ({ name })) },
});
const check = (text, branch, labels, options) => evaluate('pull_request', event(text, branch, labels), options);

for (const [name, text, branch, labels, status, checked, unchecked] of [
  ['ordinary PR', null, 'feature/example', [], 'out-of-scope', 0, 0],
  ['agent needs section', null, 'copilot/fix', [], 'incomplete', 0, 0],
  ['prefix case sensitive', null, 'Copilot/fix', [], 'out-of-scope', 0, 0],
  ['complete', body('- [x] Observe success'), 'feature/x', [], 'complete', 1, 0],
  ['uppercase X', body('- [X] Observe success'), 'feature/x', [], 'complete', 1, 0],
  ['incomplete', body('- [x] Success\n- [ ] Failure'), 'feature/x', [], 'incomplete', 1, 1],
  ['empty section', body(''), 'feature/x', [], 'incomplete', 0, 0],
  ['wrong heading level triggers but fails', '### Manual acceptance tests\n- [x] Yes', 'feature/x', [], 'incomplete', 0, 0],
  ['inline heading triggers but fails', 'text ## Manual acceptance tests\n- [x] Yes', 'feature/x', [], 'incomplete', 0, 0],
  ['CRLF', '## MANUAL ACCEPTANCE TESTS\r\n- [x] Observe\r\n', 'feature/x', [], 'complete', 1, 0],
  ['next section ignored', body('- [x] Yes\n## Other\n- [ ] Later'), 'feature/x', [], 'complete', 1, 0],
  ['checked outside section ignored', body('nothing\n## Other\n- [x] Later'), 'feature/x', [], 'incomplete', 0, 0],
  ['nested item', body('  - [x] Yes'), 'feature/x', [], 'complete', 1, 0],
  ['other bullet unsupported', body('* [x] Yes'), 'feature/x', [], 'incomplete', 0, 0],
  ['design exemption', null, 'copilot/fix', ['design'], 'exempt', 0, 0],
  ['explicit bypass', body('- [ ] No'), 'copilot/fix', ['skip-manual-acceptance-tests'], 'exempt', 0, 0],
  ['no partial label match', null, 'copilot/fix', ['skip-manual-acceptance-tests-extra'], 'incomplete', 0, 0],
  ['no label case folding', null, 'copilot/fix', ['Design'], 'incomplete', 0, 0],
  ['first section only (source compatibility)', body('- [x] Yes\n## Manual acceptance tests\n- [ ] Later'), 'feature/x', [], 'complete', 1, 0],
  ['fenced text counts (source limitation)', body('```\n- [x] Example\n```'), 'feature/x', [], 'complete', 1, 0],
  ['HTML comment counts (source limitation)', body('<!--\n- [x] Example\n-->'), 'feature/x', [], 'complete', 1, 0],
  ['blank item lacks description', body('- [x]'), 'feature/x', [], 'incomplete', 0, 0],
]) {
  test(name, () => {
    const actual = check(text, branch, labels);
    assert.deepEqual(actual, { status, enforced: ['complete', 'incomplete'].includes(status), checked, unchecked });
  });
}

test('label removal restores enforcement and edits clear completed state', () => {
  assert.equal(check(body('- [ ] Observe'), 'copilot/a', ['skip-manual-acceptance-tests']).status, 'exempt');
  assert.equal(check(body('- [ ] Observe'), 'copilot/a', []).status, 'incomplete');
  assert.equal(check(body('- [x] Observe'), 'copilot/a').status, 'complete');
  assert.equal(check(body('- [ ] Observe'), 'copilot/a').status, 'incomplete');
});

test('configuration supports literal headings, multiple prefixes, exact labels and require-all', () => {
  assert.equal(check('## Review (UI)?\n- [x] Works', 'codex/a', [], {
    heading: 'Review (UI)?', branchPrefixes: ['agent/', 'codex/'], skipLabels: [],
  }).status, 'complete');
  assert.equal(check(null, 'feature/x', [], { requireAll: true }).status, 'incomplete');
  assert.equal(check(null, 'feature/x', ['waived'], { requireAll: true, skipLabels: ['waived'] }).status, 'exempt');
  assert.equal(check(null, 'copilot/x', [], { branchPrefixes: [] }).status, 'out-of-scope');
  assert.equal(check(null, 'copilot/x', ['design'], { skipLabels: [] }).status, 'incomplete');
});

test('merge queue explicitly skips and fork target events use metadata only', () => {
  assert.equal(evaluate('merge_group', {}).status, 'merge-group');
  assert.equal(evaluate('pull_request_target', event(body('- [x] Works'))).status, 'complete');
});

test('malformed payload and unsupported events fail closed', () => {
  for (const payload of [{}, { pull_request: {} }, event(null, 'copilot/x', [])]) {
    if (payload.pull_request?.head) payload.pull_request.labels = ['design'];
    assert.throws(() => evaluate('pull_request', payload));
  }
  assert.throws(() => evaluate('push', {}));
  assert.throws(() => check(null, 'copilot/x', [], { heading: 'bad\nheading' }));
});
