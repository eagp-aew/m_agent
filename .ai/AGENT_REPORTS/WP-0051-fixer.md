# WP0051 segment A bounded repair 1

task_id: WP-0051-local-chat-integration
agent_role: fixer
status: PASS
one_sentence_result: ERR-WP0051-001 is reproduced and repaired by excluding only the exact expected SQLite automatic index; all 18 targeted tests pass, pending independent review, with full WP0051 unaccepted.
files_read: AGENTS.md; .agents/skills/direction-guide/SKILL.md; .ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml; .ai/AGENT_REPORTS/WP-0051-verifier.md; personal-co/server/chat-operation-store.mjs; personal-co/tests/chat-operation-store.test.mjs.
files_changed: personal-co/server/chat-operation-store.mjs; personal-co/tests/chat-operation-store.test.mjs; .ai/AGENT_REPORTS/WP-0051-fixer.md.
commands_run:
  - read_only / packet-scoped inspection: pwd, sed, wc, shasum, scoped git status; PASS. Initial combined output was truncated, so required skill/source/package/verifier/test reads were completed with bounded follow-up reads.
  - controlled_write / exact reserved files: apply_patch added regressions before changing the source predicate, then created this report; PASS. No unrelated changes or dependencies.
  - validation / fresh retained synthetic fixtures: node --test personal-co/tests/chat-operation-store.test.mjs before source repair; expected FAIL, 13 passed and 5 failed with Missing expected exception.
  - validation / same targeted suite after repair: node --test personal-co/tests/chat-operation-store.test.mjs; PASS, 18 passed, 0 failed.
  - validation / source syntax: node --check personal-co/server/chat-operation-store.mjs; PASS.
  - read_only / whitespace: git diff --check; PASS. Product files are pre-existing untracked implementation files, so this is supplemented by exact repair delta and hashes below, not claimed as a tracked product diff audit.
  - read_only / frozen evidence: shasum -a 256 personal-co/server/chat-operation-store.mjs personal-co/tests/chat-operation-store.test.mjs; hashes below.
tests_run: Original 12 retained tests passed before and after repair. Added 5 unexpected-schema cases (sqliteX trigger/table/view/index and ANALYZE-generated internal tables) failed before repair and pass after it; each repaired case rejects two reopen attempts with CORRUPT and preserves database bytes and directory entries. Added expected primary-key automatic-index shape/reopening test passes and confirms duplicate reservation remains false with unknown receipt retained.
evidence: Verifier ERR-WP0051-001 supplied concrete true/null/true duplicate-dispatch evidence. New retained regression creates the exact sqliteXerase deletion trigger in a fresh fixture and now rejects reopening, preventing receipt-store dispatch access. Source schema() remains invoked on the existing read-only DatabaseSync handle before the writable connection or writable pragmas. No old verifier fixture or private runtime was read. This report is the repair evidence source, not independent acceptance.
risks: This is segment-only evidence; host/UI/native/provider/context integration remains outside scope and full WP0051 is unaccepted. Same-UID concurrent schema tampering remains outside the existing documented trust model. Future schema changes must explicitly update the expected internal index; unexpected ANALYZE tables are intentionally rejected because this store never creates them. No hardware power-loss claim or broader SQLite-hardening claim is made.
assumptions: Packet fields validated complete; master owns project memory and frozen author work. The pinned built-in SQLite emits sqlite_autoindex_operations_1 for the existing TEXT primary key, confirmed by regression. Packet read scope takes precedence over the skill's broad master-memory checklist; no delegation or master-wide memory reads were performed.
recommended_next_action: Independently reverify these exact source/test hashes and the original adversarial trigger scenario before segment acceptance; master retains responsibility for memory and broader integration.
child_agent_requests: none
child_report_bundle: none

root_cause: SQL LIKE interprets underscore as a single-character wildcard, so sqliteXerase matched sqlite_% and was hidden from exact schema comparison. Prefix exclusion also ignored unexpected actual SQLite-generated objects.
patch_summary: Replace the wildcard exclusion with a four-field match for only the known automatic primary-key index; preserve existing schema comparison, lifecycle, APIs, and all other logic. Add six regression cases without dependencies or cleanup/deletion.
failure_classification: IMPLEMENTATION_BUG / chat-operation-store-sql-like-wildcard-hides-user-trigger
verifier_evidence_addressed: Yes, the exact injected trigger now fails the existing read-only schema check before reserve can be called; independent confirmation remains required.

## Exact source delta

```diff
-    const objects = db.prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.sql);
+    const objects = db.prepare(`SELECT sql FROM sqlite_schema
+      WHERE NOT (type = 'index' AND name = 'sqlite_autoindex_operations_1' AND tbl_name = 'operations' AND sql IS NULL)
+      ORDER BY name`).all().map(row => row.sql);
```

## Exact test insertion

Inserted immediately before `record cap fails closed without pruning and existing receipts remain readable`, with a following blank line; existing tests unchanged:

```javascript
for (const [kind, sql] of [
  ['trigger', 'CREATE TRIGGER sqliteXerase AFTER INSERT ON operations BEGIN DELETE FROM operations; END'],
  ['table', 'CREATE TABLE sqliteXextra (x TEXT)'],
  ['view', 'CREATE VIEW sqliteXview AS SELECT operation_id FROM operations'],
  ['index', 'CREATE INDEX sqliteXindex ON operations(status)'],
  ['unexpected internal tables', 'ANALYZE'],
]) test(`unexpected schema ${kind} cannot hide behind the SQLite prefix`, () => {
  const directory = fixture(); open(directory).close(); seed(directory, db => db.exec(sql));
  const databasePath = path.join(directory, CHAT_OPERATIONS_FILE);
  const before = fs.readFileSync(databasePath); const entries = fs.readdirSync(directory).sort();
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.throws(() => { const store = open(directory); store.close(); }, code('CORRUPT'));
    assert.deepEqual(fs.readFileSync(databasePath), before);
    assert.deepEqual(fs.readdirSync(directory).sort(), entries);
  }
});

test('the exact SQLite primary-key autoindex permits reopening without duplicate dispatch', () => {
  const directory = fixture(); const store = open(directory); const input = send();
  assert.equal(store.reserve(input).dispatchAllowed, true); store.close();
  seed(directory, db => {
    const indexes = db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NULL').all();
    assert.deepEqual(indexes.map(row => ({ ...row })), [{
      type: 'index', name: 'sqlite_autoindex_operations_1', tbl_name: 'operations', sql: null,
    }]);
  });
  const reopened = open(directory);
  try {
    assert.equal(reopened.reserve(input).dispatchAllowed, false);
    assert.equal(reopened.get(input.operationId).status, 'unknown');
  } finally { reopened.close(); }
});
```

## Frozen SHA-256

| File | Before repair | After repair |
|---|---|---|
| personal-co/server/chat-operation-store.mjs | 2e536cdd10b5039dbe2b09340e2d56da3c690c6c43d2c1fef8803aca7ec06aac | d173daf6d2fb79a8f7888fde21c2c465c59ef21d9a39180228feaad1d3448d47 |
| personal-co/tests/chat-operation-store.test.mjs | 1725565ee2c0927525a3e487a2524b63448d049e5cdeeb312c53b524539691e0 | 516f8beef4813f311b693c792977addcd70a079d68a6398654df0221c740fdcd |

No commit, push, deletion, old-data repair, dispatch retry, network, native/provider/browser execution, configuration change, dependency installation, or child agent occurred. Fresh synthetic fixtures remain retained under the authorized prefix.
