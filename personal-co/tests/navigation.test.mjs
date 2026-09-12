import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  PROMPT_STARTERS,
  primaryForSurface,
  preparePromptDraft,
  completeChatDraft,
} from '../src/domain/navigation.mjs';

test('every existing detail remains reachable under three primary sections, with Settings separate', () => {
  assert.deepEqual(PRIMARY_SECTIONS.map((item) => item.label), ['对话', '今天', '记忆']);
  const expected = {
    Chat: 'Chat', Learning: 'Chat', Reflection: 'Chat', Today: 'Today',
    'Core Memory': 'Core Memory', 'Memory Changes': 'Core Memory', Archive: 'Core Memory', Import: 'Core Memory',
  };
  for (const [surface, primary] of Object.entries(expected)) {
    assert.equal(primaryForSurface(surface), primary);
    assert.ok(PRIMARY_SECTIONS.some((item) => item.surface === primary));
    if (surface !== 'Today') assert.equal(SECONDARY_SECTIONS.filter((item) => item.surface === surface).length, 1);
  }
  assert.equal(primaryForSurface('Settings'), null);
  assert.equal(primaryForSurface('unknown'), null);
});

test('prompt starters produce editable text and preserve existing work byte for byte', () => {
  for (const prompt of PROMPT_STARTERS) {
    assert.equal(preparePromptDraft('', prompt), prompt);
    assert.equal(preparePromptDraft(' \n ', prompt), prompt);
    for (const existing of ['继续我的简历', '  第一点\n第二点  ', PROMPT_STARTERS[0]]) {
      assert.equal(preparePromptDraft(existing, prompt), existing);
    }
  }
});

test('unsuccessful and unknown sends retain drafts including whitespace', () => {
  const submitted = '  明天会议的准备\n帮我整理材料  ';
  assert.equal(completeChatDraft(submitted, submitted, false), submitted);
  assert.equal(completeChatDraft(submitted, submitted, undefined), submitted);
  assert.equal(completeChatDraft(submitted, submitted, true), '');
});

test('a delayed success never erases a newer draft', () => {
  const submitted = '旧请求';
  assert.equal(completeChatDraft('新请求', submitted, true), '新请求');
  assert.equal(completeChatDraft('新请求', submitted, false), '新请求');
  assert.equal(completeChatDraft('旧请求\n补充', submitted, true), '旧请求\n补充');
});

test('both governance cards override the desktop basis in compact layouts', () => {
  // Source-level wiring regression only; actual control bounds still need browser QA.
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const cards = [...app.matchAll(/<View style=\{\[styles\.card, styles\.governanceCard([^\]]*)\]\}>/g)];
  assert.equal(cards.length, 2, 'cover both the forget form and session audit card');
  for (const card of cards) assert.match(card[1], /, compact && styles\.compactLearningCard$/);
  const compactStyle = app.match(/compactLearningCard:\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(compactStyle, /width:\s*'100%'/);
  assert.match(compactStyle, /minWidth:\s*0/);
  assert.match(compactStyle, /flexBasis:\s*'auto'/);
  assert.match(compactStyle, /flexGrow:\s*0/);
  assert.match(app, /card:\s*\{[^}]*flexBasis:\s*430/);
});
