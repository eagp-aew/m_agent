# WP-0049 actual native read-host evidence

task_id: WP-0049-local-browser-reader

agent_role: master-runtime-operator

status: PASS

one_sentence_result: One independently reviewed actual local host initialized its Agent, passed authenticated status/empty retained list/wrong-authority denial and confirmed owned shutdown.

files_read: .ai/AGENT_REPORTS/WP-0049-implementer.md; .ai/AGENT_REPORTS/WP-0049-verifier.md; personal-co/tests/local-read-host.test.mjs; reviewed source/build dependencies as frozen in implementer report.

files_changed: This report and scoped master metadata. Test generated a fresh private synthetic fixture only; no product/dependency edits or old-state access.

commands_run:

- bounded_native_execution: exactly the approved command below, after independent pre_execution_security_verdict PASS was persisted. Started once in session16327; polled existing handle once; exit0. No replay.

```sh
WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 WP0049_RUN_NATIVE=1 WP0049_DEPENDENCY_ROOT=/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules WP0049_WEB_ROOT=/Users/jie/Desktop/assistant/personal-co/dist WP0049_REVIEWED_SHA256=25f16d36e6c245d96385945a7762591a7ed8c6c243ce69176faf35c10081cdc6 node --test --test-name-pattern='native local browser host status and empty retained list' personal-co/tests/local-read-host.test.mjs
```

tests_run: Actual native1/1 PASS, no skips/failures. Correct browser authority status200 and empty retained list200; wrong authority403. HTTP/session and native process cleanup confirmed. Test1619ms/overall2721ms observed once, not benchmark or performance claim.

evidence:

- Diagnostic schema wp0049-native-read-host-v1. New retained fixture `external:/private/tmp/personal-co-wp0049-native-yToGex`, private state/protected children; default host, no fake session.
- Agent `agent-local-760bd91e-7b53-4498-8964-9ec4338e3af2`; HTTP origin http://127.0.0.1:59917; native PID17140 and endpoint ws://127.0.0.1:59914/ws.
- Letta0.32.5, gitHead1cf724938689a8f2bdb63bc03807db79a73d8f2d, Node24.15.0 at external:/usr/local/bin/node. Existing installation read-only at `external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules`.
- Frozen source+compiled digest `25f16d36e6c245d96385945a7762591a7ed8c6c243ce69176faf35c10081cdc6`; CLI SHA256 `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`; recovery-lock SHA256 `eb475ec460f708fe365a7c41c6691fca0fae98ba77eb08e2286fd1152206d8b7` independently reviewed before execution.
- Native ready then process_cleanup reaped/groupGone true; terminal phase closed/reason ABORTED (host lifetime cancellation), cleanup confirmed/authClosed/processReaped/groupGone/listenerGone all true, errors empty. Host cleanup confirmed/httpClosed/sessionClosed all true.
- No real provider, user input, tool/native-file commands, old state, private histories or capability values in diagnostics/reports. Synthetic browser evidence is separately attributed in .ai/AGENT_REPORTS/WP-0049-browser.md; this native test proves actual empty-reader composition, not populated native history/model quality.

risks: Temporary macOS synthetic runtime only. Trusted-tag admission is not complete privacy/deletion. Sending, provider setup, canonical model context, classification and production installation remain unfinished. Final independent artifact/process/listener corroboration PASS is recorded in .ai/AGENT_REPORTS/WP-0049-verifier.md; no replay performed.

assumptions: Same frozen source/build and reviewed installation used; new synthetic roots only. Hashes detect changes, not full supply-chain audit.

recommended_next_action: Final protocol/memory/scoped Git delivery; independent corroboration is complete, no native replay needed.

child_agent_requests: none

child_report_bundle: none
