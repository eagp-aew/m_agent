# WP0041 isolated runtime evidence

## task_id
WP-0041-app-server-contract-probe
## agent_role
master runtime operator
## status
PASS
## one_sentence_result
Published App Server0.32.5 preserves exact synthetic Agent/conversation/tags/memory across a controlled process restart under independently reviewed deny-default isolation; product governance contracts remain unproven.
## files_read
- .ai/WORK_PACKAGES/WP-0041-app-server-contract-probe.yaml
- .ai/AGENT_REPORTS/WP-0040-runtime-compatibility.md
- external: official published-revision sources described below; runtime package manifest/lock and OS sandbox profile in the isolated directory.
## files_changed
- .ai/AGENT_REPORTS/WP-0041-runtime.md
- external: generated331-package install/cache/lock and runtime.sb under /private/tmp/personal-co-wp0041.qRnOrc only. No lifecycle scripts executed.
## commands_run
- network_or_escalated, standing-authorized: npm registry GET0.32.5 and GitHub reads at published1cf724938689a8f2bdb63bc03807db79a73d8f2d. Package integrity matches sha512-b7rHPKEYe7w6iZ9MTQ9g3uvb9XTnEufXFfb553rGg2dww2xpDXQ9T8f3uSBsV8/ILBnRma15qy1scQMbuoLyUw== in generated lock. This differs from WP0040 main revision, so actual published source is authoritative for this probe.
- workspace_write/network_or_escalated: mktemp created the exact directory above; npm install with env -i, explicit PATH, userconfig=/dev/null, unused-global.npmrc in isolated directory, explicit isolated cache/prefix, --ignore-scripts --no-audit --no-fund. First attempt used /dev/null for both config roles and npm rejected double loading before install; corrected distinct empty global path,331 packages installed. No global install or app manifest changes.
- workspace_write: apply_patch runtime.sb, deny default; process exec/fork, sysctl read, system-library reads, runtime-directory reads/writes, loopback inbound/bind only. No outbound network; no workspace/user-home read/write; no keychain service; /Library/Keychains explicitly denied. Native profile requires localhost instead of numeric address in filters, corrected before execution. Metadata access only to /private and /private/tmp permits runtime path traversal. Added only com.apple.system.opendirectoryd.libinfo lookup after uv_os_homedir failed; this matches shipped system.sb usage, not keychain permission.
- read_only validation of sandbox: Node attempted reading public workspace AGENTS.md and connecting to reserved documentation IP192.0.2.1:443: both EPERM; loopback listen succeeded. No actual secret file used as test target.
- runtime execution: env -i PATH=/usr/local/bin:/usr/bin:/bin LETTA_LOCAL_BACKEND_DIR=<isolated>/state LETTA_LOCAL_BACKEND_EXPERIMENTAL=1 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null sandbox-exec -f <isolated>/runtime.sb node <isolated>/node_modules/@letta-ai/letta-code/letta.js server --backend local --listen ws://127.0.0.1:0. cwd is isolated directory; no HOME repurposing, inherited credentials or provider input. Executing normal CLI does attempt global settings mkdir; sandbox rejects it with EPERM and service continues with defaults. No protection weakened to permit user config access.
- read_only protocol: single app_server_info correlated request via Node WebSocket to observed50440/ws; returned local/0.32.5/protocol1 and capabilities agent_management,conversation_management,memory_management,runtime_start true; split_channels false.
## tests_run
Sandbox negative boundaries PASS and real info response PASS. Probe unit tests, safety review, synthetic mutations and restart pending; no model call performed.
## evidence
- external: registry https://registry.npmjs.org/@letta-ai%2fletta-code/0.32.5 and pinned GitHub source1cf724938689a8f2bdb63bc03807db79a73d8f2d: index main initializes desktop credentials only when IPC flag set, exits through server subcommand before ordinary TUI/model boot; desktop-credentials initialization checks explicit IPC env. App-server subcommand invokes startAppServer and signal-based close; local backend storage uses LETTA_LOCAL_BACKEND_DIR. Settings-manager still hardcodes home settings and errors are handled. No run/input/tool command submitted.
- external: published artifact in isolated node_modules, package-lock integrity matched exact npm metadata. Install scripts were disabled, not silently run to repair native binaries.
- Owned live execution handle21252, observed listener ws://127.0.0.1:50440/ws. Earlier handles62358 and initial path-load launch exited1 before listening. No Docker/Ollama/other services started.
## risks
Not a completed runtime contract probe. Global settings writes are blocked and warnings expected; source capabilities do not establish semantic compatibility. Git-backed memory initialization may require additional safe runtime prerequisites; never relax user-data/keychain/outbound protection to pass. Existing no-batch-deletion rule applies; temporary directory remains for evidence.
## assumptions
Same local backend, synthetic-only data and no provider credentials. Receipt verification later must be tied to an observed stop/restart; the script alone cannot attest process lifecycle.
## recommended_next_action
Independent safety review, then exact synthetic probe and owned-process stop/restart only if review passes.
## child_agent_requests
None.
## child_report_bundle
None.

## Actual probe and cleanup (supersedes pending statements above)
Both independent pre-live gates passed before any mutations: wp0041_runtime_security re-review PASS for corrected profile, with LOW unauthenticated-local-native-client residual limited to synthetic environment; wp0041_verifier script safety PASS,27 supplied and8 independently constructed adverse tests. Original security failure is retained below, not waived. No script changes after recorded hashes.

Create command: node scripts/probe_app_server_contract.mjs create ws://127.0.0.1:50530/ws. Handle47053 exited0 with observations_complete: runtime_info, tagged_agent_identity, same_agent_conversation_summary_tags and six_synthetic_memory_files all matched. Receipt: schema wp0041-receipt-v1, version0.32.5, run_id edaae8a7-c9bf-44fe-bfa7-94b7990d6e5f, agent_id agent-local-50601875-36dc-4f1e-9975-61802f54ec91, conversation_id local-conv-1, memory_written true.

Master verified PID49664 executable command, sent SIGTERM; handle62117 returned exit0 and Stopped App Server(SIGTERM). Relaunched same pinned artifact/env/profile/cwd/state as handle63060, now PID50040/listener50564. Verify command: node scripts/probe_app_server_contract.mjs verify ws://127.0.0.1:50564/ws with the exact receipt JSON above. It exited0, observations_complete and all four contract observations matched identical IDs/content. This invocation uses the independently verified read-only transport. The script truthfully keeps restart_process_observed:false; actual lifecycle evidence is this operator record, not inferred by the script.

After verify, master confirmed PID50040 command and sent SIGTERM. Handle63060 returned exit0 and Stopped App Server(SIGTERM); lsof on50564 returned no listener. No owned runtime remains. Global settings warnings remained EPERM throughout; no permissions relaxed to read/write real home. No model turns, input, runtime-start, tools, deletion, real credentials or provider calls. Six files and synthetic conversation/Agent records remain under the isolated state directory for verification. Tracked product diff is empty; temporary installation/data are intentionally retained, not batch deleted.

Observed contracts are bounded normal-restart persistence only. Six-block read-only enforcement, structured provenance, exact Archive CRUD, privacy retention, model switching and atomic snapshots remain unresolved exactly as both script outcomes state. Next useful scope is proving/enforcing those canonical memory contracts and lossless conversion before an adapter migration, not repeating this successful persistence probe or changing product UI prematurely.

Temporary footprint: du -sh reports597M for the isolated installation, npm cache and synthetic state. It is retained explicitly under the no-batch-deletion rule; nothing was deleted. Future work may reuse this exact pinned artifact/profile where evidence still applies, rather than reinstalling it.

Master closure correction2: validator28/29 passed, rejecting READY task status with VERIFY ledger phase. Updated WP/queue/ledger to IMPLEMENTED consistently; no probe/runtime behavior change. State/queue now record actual observed persistence, cleanup, remaining canonical-memory contracts and retained isolated artifacts. Final report/gate follow; original security correction1 remains separately counted.

## Independent safety review1 and bounded correction
Reviewer wp0041_runtime_security returned BLOCKED/recommendation FAIL: original recursive /usr,/System,/Library reads exceed system-library-only promise (MEDIUM); unauthenticated local native clients remain a LOW temporary-only limitation. No leak or real secret access was claimed. Reviewer independently checked pinned manifest/lock, profile, owned PID48865/listener50440 and published startup/auth/local-create source. No active tests or writes by reviewer. Full outcome is not a product compatibility verdict.

Master classified SECURITY_REGRESSION:wp0041-sandbox-broad-system-directory-reads, fix1. After exact PID command verification, sent SIGTERM48865; no synthetic data written yet. Profile now permits only Node executable, /bin/sh, /usr/lib, system Frameworks/PrivateFrameworks and exact SystemVersion.plist, CommandLineTools bin/lib/libexec/git-core templates, disposable directory and selected character devices. Ancestors metadata-only; no recursive /Library or /usr/local. Keychain, real user-data and outbound network still denied. Re-review and final-profile negative tests are required before synthetic mutations. Published source has home-path assumptions; sandbox denial, not redirecting real HOME, remains mandatory.

Correction evidence: handle21252 returned exit0 and Stopped App Server(SIGTERM). Narrow-profile Node initially required exact /System/Library/OpenSSL/openssl.cnf; allowed that single system configuration file after observed EPERM (no directory-wide permission). Final profile denied stat of public workspace AGENTS.md and /Library/Application Support,/Library/Preferences,/usr/local/share with EPERM; outbound reserved-IP connection also EPERM. Tightened runtime started as handle62117 at ws://127.0.0.1:50530/ws, still blocking global settings mkdir. No synthetic mutations yet; security re-review pending. Source/test hashes at implementation handoff are a5d2d6e39d593a8eef169f1366e5eee7ec094dea and3bd18a4db96b6f42c9d2f3a09f31db6181bc938f; syntax/whitespace and independent27 tests reported PASS, final script review pending.
