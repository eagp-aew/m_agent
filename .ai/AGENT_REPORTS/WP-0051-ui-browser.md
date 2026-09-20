# WP0051 C2 actual browser evidence

task_id: WP-0051-local-chat-integration
agent_role: master browser verification
status: PASS — final scoped synthetic browser evidence; initial failures preserved below, no native/full-WP acceptance.
one_sentence_result: Synthetic create/send/draft/unknown recovery and final accessible memory toggle-button keyboard behavior pass actual desktop/narrow browser checks.
files_read: Frozen LocalAssistant/client/host and author report; exported page DOM only through CUA. No private state.
files_changed: This master evidence report only; ignored dist regenerated with npm run export:web after receipt repair.
commands_run: Approved export PASS; CUA browser navigation/DOM/read-only measurements/screenshots/clicks/fills on synthetic loopback fixture; Node inline fixture using actual host plus controlled makeSession, no native or model; exact owned host cleanup.
tests_run: Desktop1280x900 and narrow390x844; existing actual compiled LocalAssistant, fixed HTTP routes, actual client/controller. Fake session replies explicitly labelled synthetic, not native integration/quality.

## Evidence

- Component hash c1325307b491e0e1c73e0fe00b5a41b0d1f97dc4ecf3aeb970ebabc63af487e7; repaired client07814f0d8ee14a45b8956b86f71819cc335477ef09146931e764d1d28a06c37b. Functional run DOM script index-0efe0df781461ecdb8ce9105b0e17f3f.js; source export PASS.
- Screenshots inspected in CUA: desktop side-by-side list/history and readable composer; narrow stacked scrollable panels. DOM viewport/document/body widths1280/1280/1280 and390/390/390; no horizontal overflow. Initial narrow screenshot captured before layout settled, later full390 screenshot confirmed proper layout; not counted as separate failure.
- Create 浏览器验证会话 completes via active-only read polling, clears unchanged title, explicit open action opens it; no automatic selection stealing. UUID ede264bc-87b4-483f-b91c-a7b83363b8aa.
- Preview five synthetic unknown-tagged memory paragraphs. First4 select; fifth leaves count4 and visible limit alert. Submitted send contains contextCount4, not whole memory.
- Slow synthetic send15be4029-ef8d-455a-b452-68ddf2f397e5: after sending, edit original conversation draft, switch to 日常安排, edit independent draft. Completion does not change selection or either draft. Both exact drafts read back; original conversation shows exact original input and labelled synthetic assistant reply.
- UNKNOWN send809f45c5-8f40-40e8-8b9f-a043d4b78d7e displays original text and no-resend message; send/create disabled. Manual status lookup retains same operation. Disconnect first asks confirmation; cancel preserves draft, confirm clears page only. Reopening full launch link and reloading reinitializes app, pending lookup recovers identical UUID/text and disabled mutation guard. Refresh without fragment displays 需要本地启动链接.
- Final fixture counters exactly3 dispatches: one completed create, one completed send(context4), one UNKNOWN send. Manual query/disconnect/reopen/refresh did not add dispatches.
- Defect: selected memory rows visibly show 已选择 and4selected, but all five role=checkbox elements have aria-checked=null and AX snapshot no checked state; tabindex0. Independent verifier reproduced installed SSR and confirmed compatibility cause. Keyboard checked-state proof deferred until exact component repair.

## Fixture corrections and cleanup

- Original pre-compaction host external:/private/tmp/personal-co-wp0051-browser-czqXXW port50576: stdin had closed. ExactPID82882/source identity checked; SIGINT invoked its handler, exec exited0 and listener absent. No test mutations.
- Pre-export fixture external:/private/tmp/personal-co-wp0051-browser-cZcXZt port50684: export replaced webRoot identity, so navigation blocked; old bundle not counted as repaired-build evidence. Host closed with confirmed/httpClosed/sessionClosed alltrue. Restart after export, not product change.
- Fixture external:/private/tmp/personal-co-wp0051-browser-Xy8tTu port51185 initially omitted activeOperationId from fake status. Manual create lookup completed exactly once; fixed in-memory fixture status projection to match real managed contract, stopped host alltrue, restarted fresh. Not a product defect; no polling claim from this run.
- Authoritative functional fixture external:/private/tmp/personal-co-wp0051-browser-ufBCVz port51201: final counters above; close returned confirmed/httpClosed/sessionClosed alltrue and exec exited0. Synthetic fixtures retained, no deletions.

risks: Actual native/provider/state persistence is not exercised by fake session. Unsent drafts remain page-local. Accessibility remains failing pending repair; screenshots are tool-session evidence, not committed bitmap artifacts.
assumptions: Current task authorizes synthetic local UI testing; only test-owned tabs/fixtures, no user data/model cost.
recommended_next_action: Exact component state-attribute repair, independent render recheck and fresh compiled browser checkbox/pressed/keyboard validation; reuse unchanged successful functional evidence by hashes.
child_agent_requests: []
child_report_bundle: []

## Repair2 actual-browser recheck — attributes fixed, Space behavior unresolved

Fresh componentc7a41bd824bdaeb71462e49dad327962ccab62dc031f26e7e34f07dfb225aa9a, export PASS, DOM bundle index-fe6a8d187537510b94aea8245df02471.js. Fresh synthetic fixture external:/private/tmp/personal-co-wp0051-browser-juttkQ port51303.

- Conversation activated with Enter exposes aria-pressed=true and AX pressed. Other conversation false.
- Memory selection initially aria-checked=false; Enter changes true and AX checked; another Enter changes false, one toggle each.
- New keyboard observation: Pressable rolecheckbox does not toggle on Space, tested both named Space and literal space, remains false. Same named Space on conversation rolebutton works, producing new button pressed=true and previous=false. Thus not a generic browser key-delivery failure. Independently corroborate installed key handler before repair.
- No model/native/send dispatch performed. Attribute repair itself passed; complete keyboard acceptance remains pending. Do not overwrite earlier FAIL with PASS.

## Final repair3 actual-browser recheck — PASS

Component5837688d075bff83005955704317ac65f0fbf6903853239cb5f2da394ad96a2e; client remains07814f0d. Export PASS, actual DOM bundle index-2ab04d3b7829d0ead6160a715d6d0885.js. Fresh fixture external:/private/tmp/personal-co-wp0051-browser-gIHx5n port51404.

- Memory cards now coherent rolebutton/aria-pressed, no aria-checked; native selectedstate retained. Actual initialfalse -> Space true -> Enter false. Each key causes one selection change.
- Space on firstfive cards yields first4pressed and fifthfalse, count4 plus explicit limit alert. Space deselects first, count3; no stale pressed state. Tab from first moves focus to second labelled memory button.
- Conversation Space activates selection and AX pressed; keyboard Enter opens context and Space triggers preview. Existing unknown evidence labels unchanged.
- FinalDOM width/documentwidth390/390 then1280/1280; no horizontaloverflow. Desktop screenshot inspected with keyboard focus visible, memorylist internally scrollable and composer intact. Prior create/send/draft/recovery journey reused: client/host/controller unchanged, component differences independently limited to accessibility props/role.
- Final fixture stats zero dispatches, no model/native. Host close returns confirmed/httpClosed/sessionClosed alltrue, process exits0. Earlier port51303 fixture also closed alltrue with zero dispatches. CUA viewport reset and test-owned tab9 closed. No usertabs changed, no fixture deletion.

Final risks/limitations: These are actual browser interactions with a fake-session synthetic backend, not native/provider persistence or model-quality proof. Page-local unsent draft lifetime remains disclosed. Historical accessibility FAIL findings above are resolved only by this exact final repair, not erased. Independent final verifier must combine this separate parent-observed evidence with its own source/render/keyboard checks.
