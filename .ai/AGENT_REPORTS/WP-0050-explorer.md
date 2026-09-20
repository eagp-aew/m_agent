# WP0050 pinned native chat mapping

task_id: WP-0050-local-conversation-turn

agent_role: explorer

status: PARTIAL

one_sentence_result: Pinned source supports a governed native turn, but requires synthetic-provider execution proof before browser integration; startup, tool filtering, derived context retention and unknown outcomes are not established by the existing read path.

files_read: AGENTS.md; .ai/MASTER_CONTRACT.md; .ai/WORK_PACKAGES/WP-0050-local-conversation-turn.yaml; .agents/skills/direction-guide/SKILL.md; .ai/AGENT_REPORTS/WP-0040-runtime-compatibility.md; .ai/AGENT_REPORTS/WP-0041-runtime.md; personal-co/server/authenticated-app-server.mjs; pinned external CLI below.

files_changed: Explorer none; master persisted this concise report from independent wp0050_explorer output.

commands_run: Read-only pwd/shasum/targeted sed/cat/rg/head/awk,20 calls, scope budget exhausted. No upstream import/execution/state/provider/network/dependency writes.

tests_run: NOT_RUN, source mapping only. Source SHA256 verified, not runtime semantic proof.

evidence:

All upstream line references mean `external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js`, SHA256 `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`.

| Contract | Pinned source finding |
|---|---|
| Named creation |223323/223832 correlated conversation_create body;137486–137515/138162–138176 consumes agent_id,summary,tags,model/settings,context limit,hidden. Server-generated ID; no caller idempotency field. Creation persists before prompt compilation144253, so failed response can follow committed write. |
| Exact start |397803–397882 exact existing Agent+conversation validates ownership; omit create_*,default and conversation_source_tags (latter mutates tags/summary397891). Start397960 subscribes/replays/registers external tools; replay warmup419391 runs even recover_approvals:false. Warmup413310/396927 syncs memfs, hydrates secrets and may load mods; not side-effect-free. |
| No tools |101933 execution_settings requires allowed_tools/disallowed_tools string arrays and disable_memory_guard boolean. Explicit tools:[] intersects per-input client_tool_allowlist:[]134783; filtering133089–133158 covers builtin/external/mod tools. client_toolset:{base:none,include:[]} avoids automatic selection; specific registry133537 loops supplied names. Agent tools:[] alone insufficient; startup module loading still possible. |
| Skills/limits |skill_sources:[] validated85740/retained397931/prepared413562; preload_skills:[]. max_turns:1 checks limit before normal end_turn413869, so use2 plus hostdeadline and test final semantics. |
| Native memory |Local memfs ON144218/144285 even emptyblocks. create_agent.memfs:false does not disable backend memfs; disable helper used by headless stateless456390, not App Server. Reflection default compaction-event/auto105984. |
| Reflection |set_reflection_settings exact runtime, scope:local_project, settings:{trigger:off,step_count:25,merge:explicit}; get/readback223354/398117. Omitted scope defaults both/local+global398062; local settings written within supplied cwd105930. |
| Canonical context |appendTurnInput only appends role:user or approvals138248, so input role:system is not context bridge. Host agent_update.body.system is supported; update persists/clears compiled cache138037; next turn recompiles using system hash144477–144538. Context not a user-history row, but persists in native Agent/compiled prompt as derived sensitive cache. Same-Agent serialization required. |
| Input |222878/418756: type input,request_id,runtime:{agent_id,conversation_id},payload:{kind:create_message,messages:[{role:user,content,client_message_id}],client_tool_allowlist:[],client_toolset:{base:none,include:[]},external_tool_scope_ids:[],exclude_interactive_tools:true}. |
| Receipt/dedupe |input_accepted started/queued417997/418672 precedes execution, not persistence/completion. client_message_id dedupe is runtime-memory LRU4096 only107000/417955, not durable. Local user message stores otid and projects it138424/137108. Append has no durable client-ID dedupe. |
| Persistence/terminal |User appended before executor140239; failure can leave user history. Assistant persisted through terminal chunk138272; transcript dedupe by message ID139382. update_loop_status.loop_status.client_message_ids_by_run_id maps input/run, turn_finished has runtime,turn_id,optional run_id/stopreason/error/usage401868 and consumer455430. Confirm terminal AND persisted assistant, not stream text. |
| Abort |abort_message runtime+optional run ID223027; mismatchfalse, actualabort pausesqueue414539; response success/aborted418840. Local runmaps memory-backed140284; sync/replay not durable exactly-once receipt. |
| Synthetic provider |LMSTUDIO_BASE_URL=http://127.0.0.1:owned-port/v1 and model lmstudio/synthetic supported84297. GET /api/v0/models first140922 (404/empty acceptable), GET /v1/models and SSE POST /v1/chat/completions140691/140785; fallback not-needed removes Authorization140771. No real credentials/model installation necessary. |

risks: No-tools is not no module initialization; warmup/secret hydration/mod loading still need synthetic isolation and observation. Memfs remains on; reflection-off is narrower. Derived system/compiled caches carry retention duties, never second memory truth. Native dedupe cannot promise cross-restart exactly-once; existing read-only response validator/unsolicited32 budget cannot safely process turn streams.

assumptions: Current exact pin/accepted local backend authoritative; fresh synthetic state only; host canonical store remains source of truth.

recommended_next_action: Independently review and run a bounded synthetic-provider native-turn probe before modifying browser write path. Prove startup traffic, explicit no-tools/reflection-off, host canonical projection, accepted-vs-finished persistence, failure/cancellation/unknown boundaries, ordinary restart and owned cleanup. No live-model quality claim.

child_agent_requests: none

child_report_bundle: none

Master corroboration: inspected cited exact-start, no-tools intersection and hash-based system recompilation excerpts; existing canonical store/codec/bootstrap can supply Agent-bound six-block snapshot while native protected-directory access stays denied. Current10s HTTP read cancellation and read-only socket validator are not safe mutation delivery/receipt semantics. A real native-turn probe is a required compatibility step before the planned chat UI, not a replacement goal.
