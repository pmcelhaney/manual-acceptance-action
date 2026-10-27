import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../src/checklist.js';

const root = fileURLToPath(new URL('../', import.meta.url));
// Windows Git checkouts can convert Markdown/YAML to CRLF. Compare their
// content independently of checkout line-ending policy.
const text = path => readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
const readme = text('README.md');
const example = text('examples/manual-acceptance-tests.yml');
const skill = text('skills/manual-acceptance/SKILL.md');

test('documented workflow and setup prompt agree on published artifacts', () => {
  const workflow = [...readme.matchAll(/```yaml\n([\s\S]*?)```/g)][0][1];
  assert.equal(workflow, example);
  const prompt = /```text\n([\s\S]*?)```/.exec(readme)[1];
  const actionPin = /manual-acceptance-action@([a-f0-9]{40})/.exec(example)[1];
  assert.ok(prompt.includes(actionPin));
  const skillPin = /skill_revision=([a-f0-9]{40})/.exec(readme)[1];
  assert.ok(prompt.includes(skillPin));
  assert.ok(prompt.includes('skills/manual-acceptance/SKILL.md'));
  assert.ok(prompt.includes('examples/manual-acceptance-tests.yml'));
});

test('README shell installer installs a project skill, preserves existing work and fails without overwriting',
  { skip: process.platform === 'win32' && 'POSIX installer; exercised on Linux and macOS' }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'acceptance-adoption-'));
    try {
      const consumer = join(dir, 'consumer');
      const bin = join(dir, 'bin');
      mkdirSync(consumer);
      mkdirSync(bin);
      mkdirSync(join(consumer, '.github/workflows'), { recursive: true });
      writeFileSync(join(consumer, '.github/workflows/ci.yml'), 'existing CI\n');
      writeFileSync(join(consumer, 'AGENTS.md'), 'Existing contributor instructions.\n');
      // Replace only network transport. Run the README's actual shell commands.
      writeFileSync(join(bin, 'curl'), '#!/bin/sh\nset -eu\nprintf "%s\\n" "$@" > "$CURL_TRACE"\n[ "${CURL_FAIL:-0}" = 0 ] || exit 22\nwhile [ "$1" != --output ]; do shift; done\ncp "$SKILL_FIXTURE" "$2"\n', { mode: 0o755 });
      const script = /```sh\n(set -eu[\s\S]*?)```/.exec(readme)[1];
      const destination = join(consumer, '.agents/skills/manual-acceptance/SKILL.md');
      const env = { ...process.env, PATH: bin + ':' + process.env.PATH,
        SKILL_FIXTURE: join(root, 'skills/manual-acceptance/SKILL.md'), CURL_TRACE: join(dir, 'curl-args') };
      const install = extra => spawnSync('/bin/sh', ['-c', script], { cwd: consumer, encoding: 'utf8', env: { ...env, ...extra } });
      const first = install();
      assert.equal(first.status, 0, first.stderr);
      assert.equal(readFileSync(destination, 'utf8'), skill);
      const revision = /skill_revision=([a-f0-9]{40})/.exec(script)[1];
      assert.ok(readFileSync(env.CURL_TRACE, 'utf8').includes('https://raw.githubusercontent.com/pmcelhaney/manual-acceptance-action/' + revision + '/skills/manual-acceptance/SKILL.md'));
      writeFileSync(destination, 'Local custom skill\n');
      assert.equal(install().status, 1);
      assert.equal(readFileSync(destination, 'utf8'), 'Local custom skill\n');
      rmSync(join(consumer, '.agents/skills/manual-acceptance'), { recursive: true });
      assert.equal(install({ CURL_FAIL: '1' }).status, 22);
      assert.ok(!existsSync(destination));
      assert.equal(readFileSync(join(consumer, '.github/workflows/ci.yml'), 'utf8'), 'existing CI\n');
      assert.equal(readFileSync(join(consumer, 'AGENTS.md'), 'utf8'), 'Existing contributor instructions.\n');
      // Install the documented workflow alongside existing CI in the fixture.
      writeFileSync(join(consumer, '.github/workflows/manual-acceptance-tests.yml'), example);
      assert.equal(readFileSync(join(consumer, '.github/workflows/ci.yml'), 'utf8'), 'existing CI\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

test('skill checklist example is enforced by the real Action parser', () => {
  const checklist = /## Manual acceptance tests\n\nSetup:[\s\S]*?(?=\nTailor this example)/.exec(skill)[0];
  const event = (body, labels = []) => ({ pull_request: {
    body, head: { ref: 'feature/search' }, labels: labels.map(name => ({ name })),
  } });
  assert.equal(evaluate('pull_request_target', event(checklist)).status, 'incomplete');
  const complete = evaluate('pull_request_target', event(checklist.replaceAll('- [ ]', '- [x]')));
  assert.equal(complete.status, 'complete');
  assert.equal(complete.checked, 2);
  assert.equal(evaluate('pull_request_target', event(checklist, ['skip-manual-acceptance-tests'])).status, 'exempt');
  assert.equal(evaluate('pull_request_target', event(checklist)).status, 'incomplete');
});
