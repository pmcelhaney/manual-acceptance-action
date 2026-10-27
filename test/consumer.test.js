import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const entrypoint = fileURLToPath(new URL('../src/main.js', import.meta.url));
test('consumer invocation: pass/fail, outputs, bypass removal, hostile data, invalid configuration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acceptance-consumer-'));
  try {
    const eventPath = join(dir, 'event.json');
    const outputPath = join(dir, 'output');
    const marker = join(dir, 'must-not-exist');
    const run = (body, labels = [], inputs = {}, eventName = 'pull_request') => {
      writeFileSync(eventPath, JSON.stringify({ pull_request: {
        body, labels: labels.map(name => ({ name })), head: { ref: 'copilot/demo' },
      } }));
      writeFileSync(outputPath, '');
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('INPUT_')));
      const processResult = spawnSync(process.execPath, [entrypoint], { cwd: dir, encoding: 'utf8', env: {
        ...env, GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath, ...inputs,
      } });
      return { ...processResult, output: readFileSync(outputPath, 'utf8') };
    };
    const hostile = '## Manual acceptance tests\n- [x] $(touch ' + marker + ') `${{ secrets.TOKEN }}`\n::error::injected';
    const pass = run(hostile);
    assert.equal(pass.status, 0);
    assert.equal(pass.output, 'status=complete\nenforced=true\nchecked=1\nunchecked=0\n');
    assert.ok(!pass.stdout.includes('::error::'));
    assert.ok(!existsSync(marker));
    const unfinished = '## Manual acceptance tests\n- [ ] Observe error';
    assert.equal(run(unfinished).status, 1);
    const bypass = run(unfinished, ['skip-manual-acceptance-tests']);
    assert.equal(bypass.status, 0);
    assert.match(bypass.output, /status=exempt\nenforced=false/);
    assert.match(bypass.stdout, /does not establish acceptance completion/);
    assert.equal(run(unfinished, []).status, 1);
    assert.equal(run(hostile, [], { 'INPUT_REQUIRE-ALL': 'invalid' }).status, 1);
    assert.equal(run(hostile, [], {}, 'push').status, 1);
    assert.equal(run(hostile, [], {}, 'merge_group').status, 0);
    assert.equal(run(null, [], { 'INPUT_BRANCH-PREFIXES': '' }).status, 0);
    assert.equal(run(null, ['::error::injected']).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
