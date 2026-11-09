## Unsubscribe reliability (2026-11-08)

Unsubscribe no longer returns a success page when storage is unavailable or the atomic remove fails. Those cases return HTTP 503 and tell the visitor the request was not completed. Confirmed removals use one Redis EVAL so membership, token, and signup date stay aligned. Token checks use a length-checked timing-safe compare before the write.

Validation: `npm run --prefix tests test:unsubscribe` (mocked storage only; no production list changes).
