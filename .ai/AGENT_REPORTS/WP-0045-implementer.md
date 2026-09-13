# WP0045 implementation history
## task_id
WP-0045-authenticated-app-server
## agent_role
implementer wp0044_implementer
## status
PARTIAL
## one_sentence_result
Host authenticated connection and controlled tests implemented; independent security/native proof pending. Initial dependency stop preserved below.
## files_read
Instructions/WP45/packet, sandbox/probe helper, Expo manifest/lock, pinned native auth/protocol and installed ws8.21.3 framing limits.
## files_changed
Four assigned paths: personal-co/server/authenticated-app-server.mjs261 lines, personal-co/tests/authenticated-app-server.test.mjs389, personal-co/server/package.json9, personal-co/server/package-lock.json36. Approved fresh generated server/node_modules/ws; no existing frontend/runtime edits.
## commands_run
Authorized read_only source/Git/hash; apply_patch only four reserved files. Initial root install dry-run stopped. Revised npm --prefix personal-co/server install --ignore-scripts --no-audit --no-fund --omit=optional added1 package/no removals. git diff --check and actual four-file whitespace checks PASS; no-index exit1 represents additions.
## tests_run
node --test personal-co/tests/authenticated-app-server.test.mjs:15 PASS/native1 SKIP. Existing sandbox/confinement21 PASS; cd personal-co && npm run typecheck PASS. Native upstream NOT_RUN pending independent review; protocol closure master-owned. Real loopback header/auth/redirect/fragment-limit/40-heartbeat tests passed.
## evidence
Dry-run proposed root ws upgrade/two nested placements and removal of lightningcss-darwin-arm64@1.33.0, fsevents@2.3.3, nested expo/ws8.21.3. Explicit WP no-batch-deletion/unrelated-change stop honored.
## risks
Original root install avoided. Actual native auth pending; host capability is not browser-user/per-Agent authorization. Named conversations only, default alias intentionally excluded. JavaScript capability erasure not guaranteed; review digest not authentication/proof of review.
## assumptions
Preserve unrelated installed dependencies; standing authorization does not remove deletion restriction.
## recommended_next_action
Independent pre-execution security review, then exact opt-in native test and final verification. No additional service or unrelated dependency changes.
## child_agent_requests
None.
## child_report_bundle
None.

## Final frozen evidence
Private >=256bit capability, SHA256-only argv, header-only ws8.21.3, bounded sockets/pending/messages/fragments, static errors, no retries, native identity before ready. Read query subset matches pinned local implementation; unsupported filters/mutations rejected. During implementation main caught missing heartbeat handling/ignored filters, corrected before freeze. Main ID-control suspicion was not reproduced in Node; full-match equality added defensively, not recorded as failed fix.

SHA256 module54b94e68b4e546c4c75c00f986da6ab5f1685175fc231b93dae556af48f06068; test6cc48be17e0415f3d799dc2ecf57374e6037a7c820d8ef45490a536c28de5242; manifestab35abf7940ec3f5534d838350d5cbff73e724ecd62d6fabcccd9de10a66fa03; lockb4907aef21c4650f01d49c6870b051419a2795f4746ffbd001701bd1b14dfecc. Combined18f7cdaa322a99a42a82f10c0a6ad32cfec09b2dafd01e7007c8fdb4de92ac4d covers those4 plus unchanged sandbox/confinement helper sources. Main independently confirmed four hashes/695 lines.

After independent PASS only: `WP0045_RUN_NATIVE=1 WP0045_REVIEWED_SHA256=18f7cdaa322a99a42a82f10c0a6ad32cfec09b2dafd01e7007c8fdb4de92ac4d node --test --test-name-pattern='native capability authentication' personal-co/tests/authenticated-app-server.test.mjs`.
