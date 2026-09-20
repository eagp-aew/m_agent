# WP-0049 actual browser QA

task_id: WP-0049-local-browser-reader

agent_role: master-browser-qa

status: PASS

one_sentence_result: Real compiled Expo local surface passes responsive/read/privacy/display/recovery checks; the pre-handoff rapid-selection race was reproduced, corrected by its author and passed a fresh targeted browser replay.

files_read:

- personal-co/App.tsx; personal-co/src/components/LocalAssistant.tsx; personal-co/src/services/local-read-client.mjs; personal-co/server/local-read-host.mjs; personal-co/server/conversation-reader.mjs.
- Compiled personal-co/dist/index.html and personal-co/dist/_expo/static/js/web/index-7e684b7634c521644df45d7cf6afeb11.js; generated `external:/private/tmp/personal-co-wp0049-browser.q8HsVM/fixture.mjs`.

files_changed: This report and one authorized external generated synthetic fixture driver. Main did not edit product code.

commands_run:

- workspace_write: apply_patch created exact external fixture driver. It starts current HTTP host using real retained-only reader over synthetic RPC, no native runtime/provider/private data.
- verification: `node /private/tmp/personal-co-wp0049-browser.q8HsVM/fixture.mjs`, tool session96950, loopback origin http://127.0.0.1:59405. Public synthetic capability injected; its value is intentionally omitted here.45 synthetic conversations,23 messages per conversation; retained/temporary/unmarked cases, filtered-empty pagination, synthetic errors and1500ms delayed history.
- UI verification: CUA in-app browser tab8, default1280x720 then explicit390x844; visible controls, accessibility state, screenshots and read-only DOM geometry. No browser storage inspection, real credentials or third-party transmission.
- read_only: SHA256 inspection of compiled/source/driver files; console error check after legacy navigation returned none.

tests_run:

- PASS: launch fragment removed before requests; URL becomes same-origin local-mode query, visible connected/read-only status and synthetic Agent identity.
- PASS: initial list omits temporary conversation2 and unmarked3 while showing retained1,4,5 and continuation.
- PASS: conversation1 history displays chronological text. Load earlier prepends messages1–3 before4–22 without duplicates;23rd synthetic item contains literal HTML-like text. DOM image count0, no execution/dialog; attachment omission notice visible.
- PASS: search for synthetic empty-page group returns no retained first-page rows but explicitly offers continuation; next page shows retained44 and45, not false empty completion.
- PASS: synthetic error search shows explicit failure; nonexistent search shows distinct genuine-empty guidance. Search changes clear selected history.
- PASS: desktop1280 and narrow390 screenshots inspected. No horizontal overflow (scrollWidth equals viewport); sampled buttons44px or taller and inside390px width. Separate list/history scrolling works; ordinary form/header targets usable.
- FAIL, pre-handoff integration: rapidly selecting delayed conversation4 then5 leaves5 selected but shows history-read failure despite no privacy change; current delivery reaches reader before canceled previous operation releases busy. No stale content leak observed. Exact UI sequence was two clicks on those visible named rows after search for synthetic learning records.
- PASS: explicit reload of failed selected history recovers. Disconnect removes identity/list/history and shows cleared-page help. Reload after fragment removal shows missing-link guidance without key prompt.
- PASS: ordinary root without local marker renders existing legacy offline application (chat/learning/reflection/today/memory/settings, disabled offline send), not the local viewer. Console errors none on this navigation.

evidence:

- CUA actual-page observations above use built application and real local HTTP/reader composition, not a screenshot mock. Synthetic data is visibly labeled as such; no real-model/live-user-history claim.
- Implementer notified of concrete rapid-selection sequence before final freeze; author is reproducing and adding bounded one-active/three-waiting delivery coordination with no cursor replay. This is unfinished author implementation feedback, not an accepted result or independent final verifier repair.
- Browser source/build unchanged during the completed UI checks. HTTP draft loaded by session96950; final host correction must be loaded in a fresh fixture process before targeted rapid-switch recheck.

error: {error_id: ERR-WP0049-BROWSER-001, error_category: INTEGRATION_CONFLICT, error_code: HTTP_READER_BUSY_ON_RAPID_SELECTION, retryable: true, side_effect_risk: low, idempotency_key: null, evidence: "Actual browser delayed4 then5 shows read error; fake session uses real single-operation reader.", recommended_action: "Bound delivery handoff without retrying a consumed cursor; add regression and rerun this browser sequence."}

risks: Synthetic HTTP/browser evidence does not establish native runtime/provider quality. Temporary local mode and trusted retained-tag convention are not full privacy/deletion or production deployment. Independent security/native verification is separately recorded in .ai/AGENT_REPORTS/WP-0049-verifier.md.

## Final targeted replay

- Fresh driver `external:/private/tmp/personal-co-wp0049-browser-final.dVKl9n/fixture.mjs`, real final HTTP host and retained-only reader with synthetic session. Origin http://127.0.0.1:59751, session60602, PID16572. Each conversation's message text now includes its synthetic conversation ID, allowing stale-content checks. No native runtime/provider involved.
- Final host SHA256 `2b64c649fbd157020f638be4d91fc47b931b625f578681c56a1d441249aeed58`. Unchanged compiled index SHA256 `63aa3ba3ac661a4c25a798caeedc69b6c1b5e0d4bf41b5225b4b83024bb3d565`; unchanged JS SHA256 `868e8171fe0cbc6888614ab22815d1db691bcc459c3485ec80a03be3a89ed0db`. Reused unaffected broad UI evidence above, not repeated.
- PASS: actual rapid clicks delayed conversation4 then5; after settlement message text identifies conversation5, conversation4 text absent, no history failure,390px width retained. Latest result wins without disabling selection.
- PASS: slow synthetic search immediately superseded by normal search; latest list visible, no failure or stale history. Author's independent HTTP regression also records pre-fix429 and post-fix bounded handoff, but is not substituted for these actual-browser observations.
- CUA viewport reset and agent-created tab8 closed. Both exact owned fake hosts received SIGINT and reported confirmed HTTP/session cleanup; no directories or user files deleted. Original session96950 had one create/one close,40 synthetic requests; final session60602 had one create/one close,16 requests. Separate post-stop connection probes refused both ports59405 and59751; fixture roots retained.
- Historical error ERR-WP0049-BROWSER-001 above is resolved by author before independent final handoff. It remains recorded rather than erased.

assumptions: Only generated synthetic fixture touched; current compiled Expo bundle used. Unchanged UI evidence may be reused after a host-only correction, but affected rapid-switch behavior requires fresh validation.

recommended_next_action: Independent frozen-source/security review and guarded native check; browser slice passes, full assistant remains incomplete.

child_agent_requests: none

child_report_bundle: none
