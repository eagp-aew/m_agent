# WP0044 actual execution evidence

## Attempt 1 after independent pre-execution PASS
Command: `node scripts/probe_runtime_confinement.mjs --dependency-root /private/tmp/personal-co-wp0041.qRnOrc/node_modules --reviewed-source-sha256 2a25906da3786ce5b2d98123644d67b4f22b20cad61e3e4bc05599b10190add2`.

Master execution, darwin Node24.15.0 /usr/local/bin/node; published runtime0.32.5 gitHead1cf724938689a8f2bdb63bc03807db79a73d8f2d CLI00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df. External synthetic fixture /private/tmp/personal-co-wp0044-h7nftx retained, separate state/protected/unrelated directories; reused dependency install unchanged. Profile SHA256cf20c519cd22c96e16d827c5986f6b3814c47a0d0f33f8038a09b7a826d578b0.

Exit1; schema wp0044-confinement-v1 outcome stopped, error stage runtime_identity/code agent_mismatch, results empty. Endpoint ws://127.0.0.1:51556/ws successfully reached. Host initialization/attack checks not reached, no confinement success claim. Cleanup PID56037 reaped:true/groupGone:true, exit code0/signal null/logBytes3900; listenerGone:true. No providers, real data, installs, or repeated persistence probe. Diagnose fixed protocol expectation before any further run.

## Independent diagnosis (wp0044_security)
FAIL, IMPLEMENTATION_BUG:runtime-agent-identity-rejects-pinned-local-memory-tag. Scoped pinned local createAgent144208-144218 appends GIT_MEMORY_ENABLED_TAG (constant85257 git-memory-enabled); preparation135183 returns local body unchanged. Synthetic persisted Agent id agent-local-7dd59857-1420-4356-8a4a-dee03c44fdc7 and name match; exact tags are [marker, git-memory-enabled], whereas probe expected [marker]. Read-only assertions independently reproduce mismatch; PID56037 and group-56037 signal0 both ESRCH, port51556 ECONNREFUSED. No writes/live rerun. AC3 fails, AC5 cleanup corroborated; other claims unchanged. Recommended exact two-tag expectation with missing/duplicate/unexpected regressions, not subset matching. All report score checks true, recommendation FAIL; pre_execution_approved false until fix2 re-review. No scope/forbidden-file violations or child agents. Earlier pre-execution PASS remains historical for fix1.

## Attempt 2 after fix2 independent pre-execution PASS
Command: `node scripts/probe_runtime_confinement.mjs --dependency-root /private/tmp/personal-co-wp0041.qRnOrc/node_modules --reviewed-source-sha256 8d41c8fcae3c5ded4f88740cd10875a90c7d2e417d542bcdf98ab53851b39e46`.

Exit0, schema wp0044-confinement-v1, outcome observations_complete. Same exact darwin/Node/runtime pins as attempt1. External retained synthetic fixture /private/tmp/personal-co-wp0044-S8QEYp; profile SHA256daa3fccb8e18110a4f0f09f30861b5042aaf2a13e0aab6190574ec64b7b05bb5. Roots: reused dependency install, fixture/state, fixture/protected, fixture/unrelated. Endpoint ws://127.0.0.1:51852/ws; Agent agent-local-1a1f6e87-6f1d-4661-942d-403983e5c2bb.

Observed allowed_native_and_agent_memory exact_roundtrip. Native read_file and write_file denied EPERM. Same-profile syscall positive control passed; all14 fixed operations denied EPERM: read, write, directory_read, directory_create, rename_out, rename_in, directory_rename, link_out, link_in, symlink_read, symlink_write, canary_read, canary_write, outbound. Outbound target reserved192.0.2.1:443, no provider/model request.

Host exact bytes unchanged before/after attacks SHA2568c80d0bd98931cf84cb5fd231f1d4e0cf1c9cbf1bd3a9ed813fcbcdc789daa72; decoded canonical and unrelated canary unchanged. Authorized host store then committed/read exact same-Agent revision1, final SHA25679ec1c0a3160b8c77a118af48c3c6d251c288e04b6d20c96ab3dfbd4bca40661. No core-policy/stable-profile/goals change.

Cleanup syscall PID56764 and runtime PID56641: both reaped:true/groupGone:true, exit code0/signal null; logBytes552/5273 respectively. listenerGone:true. Own store lock cleanup only, synthetic artifacts retained. Exact observed report uses fixed-source assertions; final independent disk/hash/process corroboration pending. No real data, credentials, installs, UI switch or provider/model calls. Not production/authenticated gateway, cross-platform support, lifecycle/retention/erasure or completed migration.
