import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownText } from '../assets/format.mjs';

test('model text cannot create raw HTML or active Markdown links in exported notes', () => {
  const input = '<img src=x onerror=alert(1)>\n[click](javascript:alert(1))';
  const output = markdownText(input);
  assert.doesNotMatch(output, /(?<!\\)</);
  assert.doesNotMatch(output, /(?<!\\)\[click/);
  assert.ok(!output.includes('\n'));
  assert.ok(output.includes('\\<img'));
  assert.ok(output.includes('\\[click\\]\\('));
});

test('preexisting backslashes cannot cancel an escape', () => {
  assert.equal(markdownText('\\<tag>'), '\\\\\\<tag\\>');
});

test('plain prose and file names remain readable', () => {
  assert.equal(markdownText('Inventory unavailable: source/app.mjs'), 'Inventory unavailable: source/app.mjs');
});
