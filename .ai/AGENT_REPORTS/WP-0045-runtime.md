# WP0045 actual native capability authentication

Main ran only after .ai/AGENT_REPORTS/WP-0045-security.md independent pre-execution PASS for frozen sources.

Command: `WP0045_RUN_NATIVE=1 WP0045_REVIEWED_SHA256=18f7cdaa322a99a42a82f10c0a6ad32cfec09b2dafd01e7007c8fdb4de92ac4d node --test --test-name-pattern='native capability authentication' personal-co/tests/authenticated-app-server.test.mjs`.

Exit0,1/1 test PASS, no skipped/cancelled/failing test. Runtime test824ms, total process1895ms (observed single run, not performance benchmark). Schema wp0045-native-auth-v1. External fresh retained fixture /private/tmp/personal-co-wp0045-xf3O9C with separate state/protected roots. PID58838; endpoint ws://127.0.0.1:52211/ws. Profile SHA25628920baecf7c0c3420ad87d8c5428706f988dd994a0aafadc8e7c99aca8b1476. Six-source reviewed digest18f7cdaa322a99a42a82f10c0a6ad32cfec09b2dafd01e7007c8fdb4de92ac4d.

Actual missingBearer401; wrongBearer401; correctBearer pinned_info_and_empty_agent_list. Credential newly generated in host closure, never recorded; no Agent creation, memory/turn/provider call or confinement/restart replay. Native pin0.32.5, recorded gitHead provenance1cf724938689a8f2bdb63bc03807db79a73d8f2d, verified CLI00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df, darwin Node24.15.0 /usr/local/bin/node. Reused isolated installation unchanged.

Cleanup report: pid58838 reaped:true/groupGone:true, exit code0/signal null/logBytes4040, listenerGone:true, failures:[]. No root/global environment settings changed; no batch deletion. Final independent process/listener/profile/disk corroboration follows, not inferred from this report alone.

Boundary: host native connection authentication only, not browser-user/per-Agent authorization, full broker/UI/provider integration, lifecycle recovery or completed assistant.
