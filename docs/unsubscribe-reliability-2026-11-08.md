## Unsubscribe reliability (2026-11-08)

Unsubscribe returns HTTP 503 when storage is unavailable, removal throws, or the storage response is unrecognized. The page says removal could not be confirmed: a lost response may occur after Redis committed the removal. Missing, wrong, or concurrently replaced tokens return HTTP 400 without claiming that the address is absent. Only an integer `1` from the removal script produces a success confirmation.

Confirmed removals use one Redis EVAL, checking the token again inside the script. All three key types are checked before writing because Lua atomic execution does not provide rollback for runtime errors. Token checks use a length-checked timing-safe compare before the write. The success page acknowledges that a letter already being sent may still arrive.

Validation: `npm run --prefix tests test:unsubscribe` (mocked storage) and `npm run --prefix tests test:unsubscribe:redis` (isolated real Redis with a local Upstash-shaped HTTP adapter). Neither test contacts the hosted database or changes production lists. See [combined review](pr7-pr8-integration-review.md).
