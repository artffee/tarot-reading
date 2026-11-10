# PR #7 and PR #8 integration review

Reviewed November 10, 2026. This branch is a combined proposal; it does not merge or close either original PR, change main, or deploy production.

## Exact inputs and conflicts

- Main: `f6a04ef3c5e8158b0b30f659d43e77571948d428`.
- [PR #7](https://github.com/artffee/tarot-reading/pull/7): `053253aeaec40e6a288147adee05eb537addafc3`, open draft.
- [PR #8](https://github.com/artffee/tarot-reading/pull/8): `964f714c9c7ba0a0b43171feac06a2bc89528c5b`, open.

A local three-way integration of those exact heads produces conflicts in both `tests/package.json` and `tests/original-assets.json`. Individual GitHub mergeability does not cover this combination. Taking either file wholesale would lose a test script or a preservation update; retaining both provenance blocks would introduce a duplicate JSON property.

| File | PR #7 | PR #8 | Combined resolution |
| --- | --- | --- | --- |
| `tests/original-assets.json` | Updates signup/contact hashes; adds provenance before CARDS/EXTRA | Same signup/contact hashes plus unsubscribe hash; adds provenance after CARDS/EXTRA | One provenance object with all three entries; signup/contact values identical to both PRs; unsubscribe hash matches corrected code; every other baseline retained |
| `tests/package.json` | Adds `test:subscribe` after `test` | Adds `test:unsubscribe` at the same location | Both commands retained; adds real-Redis unsubscribe and companion verification commands; dependencies/lockfile unchanged |
| `.github/workflows/gothic-print.yml` | Adds signup step and signup/home/contact path triggers | No change | Retains #7; adds unsubscribe and `_kv.js` triggers, mocked and real-Redis unsubscribe steps, original PDF and companion checks, and original-art/PDF/companion path coverage |

Exact shared fixture values:

| Entry | Main | Both PRs / combined |
| --- | --- | --- |
| `api/subscribe.js` | `640bafe9adf375258dd1ac6bbfa4a46dde8dc897bd13487eaa1cce78f02a3aef` | `a7e3a716b1d72cb65e6f372e777adb2ae3edfbab9673c59af1e56bb7c21c41b4` |
| `contact.html` | `c430195293a0d35a9bf9b1d2156d591d4b369f690dfc465a12db97b281dc06c9` | `6cbcdae7c823498fe47b6e47aacb2bcc69c3fc61bb3b9fabeeb8b9486e9b2130` |

PR #7 leaves the original unsubscribe hash `1352a85841321f57d681808db9cafe6c34c0a843981805723ef2beef12f9745d`; PR #8 changes it to `89cce9927085d579aee0fd2791b22c4fccda53f5f9ec7cb0fc8cb24a93bbcc64`. The corrected implementation has hash `0a6ea10b3f0fa62f824b333b90cd017332e26da4b5ca6707c61eba93cdac7c72`. No artwork/PDF hash is regenerated or relaxed. CARDS and EXTRA checksums are unchanged.

## Corrections required beyond combining the two PRs

1. PR #8 still displays HTTP 200 “Already at rest / Nothing more to do” for a wrong or missing token. Neither establishes absence from the subscriber set. These paths now return HTTP 400 with explicit unverified-removal wording and a recovery contact.
2. The EVAL result `0` can mean a concurrent resubscription changed the token, not just a successful competing unsubscribe. It now uses the same unverified response. Unexpected results return 503; only numeric integer `1` confirms removal. This also removes the unsafe `Number(...)` coercion, which accepted `true`, `[1]`, or `"1"`.
3. Storage errors and lost responses now say “could not confirm” rather than assert that no deletion happened. Redis can commit a removal before its HTTP response is lost.
4. Lua execution prevents interleaving but is not rollback. Wrong-type data in the date key previously caused an error after membership/token deletion. The script now checks all three key types before any write, and checks the current token inside the atomic operation. It makes no claim of universal rollback on every possible server failure.
5. The success page no longer promises that no future message can arrive: a broadcast already in flight can still be delivered.
6. PR #8's successful Gothic workflow did not run either the signup or unsubscribe unit suites. The combined workflow explicitly runs both, and the real Redis scenarios. Existing browser and PDF steps remain mandatory.

## Storage compatibility and integration limits

`api/_kv.js` sends a JSON Redis command array by authenticated POST to `KV_REST_API_URL`, falling back to the Upstash environment names. EVAL uses three declared keys followed by email/token arguments; these match the signup set/hash schema. No SDK or production dependency is added. The [Upstash REST documentation](https://upstash.com/docs/redis/features/restapi) and [Upstash Lua/EVAL documentation](https://upstash.com/blog/lua-scripting-on-upstash-redis-atomic-operations-over-http) support this command shape, integer result envelope and server-side atomic execution. This is an Upstash/Vercel KV REST implementation, not a portable guarantee for arbitrary Redis Cluster configurations with unrelated key slots.

Read-only Vercel inspection identified `thecatpriestess`, project `prj_tRcz4gmLjp2GwjUtsoLsgGAh62oR`, as the repository's production deployment. `KV_REST_API_URL` and `KV_REST_API_TOKEN` are configured for both production and preview. Their sensitive values were unavailable; the live endpoint identity, credentials and command permissions were not verified. Preview must therefore not be assumed to contain an isolated test database.

The integration test launches its own Redis server, disables persistence and uses only synthetic `example.test` addresses. It runs the actual handler and `_kv.js` through a local HTTP adapter implementing the documented Upstash response shape. Lua and stored state are real; the cloud HTTP service is simulated. This proves local Redis behavior and REST-helper interoperability, not hosted-provider availability, live unsubscribe behavior or email delivery. No customer list or production endpoint was mutated.

## Validation

| Check | Result on the combined code |
| --- | --- |
| Signup API/client tests | 5 passed; mocked storage/mail |
| Unsubscribe API tests | 11 passed; mocked storage, including malformed replies and stale tokens |
| Real Redis integration | 9 scenarios passed under Redis 7.2.7 (10 Node test entries including the parent suite); successful deletion, other-subscriber preservation, invalid/missing tokens, token rotation, concurrent duplicates, wrong-type preflight, HTTP/Redis/JSON failures, missing EVAL result and lost reply after commit |
| Deck integrity and preservation | Passed; 78 cards, 79 decoded Gothic images, reading/gallery flows, strict original file hashes |
| Gothic published PDFs | Passed: 9 PDFs, 113 pages, 672 placements, original-resolution image streams and both duplex transforms |
| Original oracle PDFs | Passed: 8 PDFs, 56 pages, 320 exact-artwork placements |
| Companion | Passed: 192 pages, 78 complete card sections, all exact source text, artwork, links and embedded fonts |
| Independent content comparison | All `cards/`, `deck/`, `decks/`, `companion/`, original CARDS/EXTRA and release hash manifests identical to main and both original PR heads; only the three reviewed application hashes change; no duplicate JSON keys or removed fixture entries |
| Local real Chromium | Blocked by this environment: `socket() failed: Operation not permitted`; unchanged full suites retained for CI |

Original exact-head CI was inspected: [#7 run 42249542410](https://github.com/artffee/tarot-reading/actions/runs/42249542410) passed signup, deck preservation, Gothic browser/PDF and original browser tests; [#8 run 42554414250](https://github.com/artffee/tarot-reading/actions/runs/42554414250) passed deck/browser/PDF tests but contained no signup/unsubscribe test step. These results are not evidence for the new combined head. The combined PR's new workflow must pass before approval to merge.

Reproduce locally:

```sh
npm ci --prefix tests
npm run --prefix tests test:subscribe
npm run --prefix tests test:unsubscribe
# Requires redis-server and redis-cli, or REDIS_SERVER / REDIS_CLI executable paths.
npm run --prefix tests test:unsubscribe:redis
npm run --prefix tests test:decks
python3 tests/verify-gothic-downloads.py
python3 tests/verify-downloads.py
npm run --prefix tests test:companion
# Requires Playwright Chromium, or CHROMIUM_PATH.
npm run --prefix tests test:gothic-print
npm test --prefix tests
```

## Integration and approval plan

Preferred: review this single combined proposal, built by taking #7's preservation/CI improvements, incorporating #8, and applying the corrections above. After the combined head passes CI and the owner approves, merge the combined PR and close #7/#8 as superseded. This avoids deploying an intermediate implementation or relying on Git's resolution of the overlapping fixture additions.

If retaining two separate PRs is preferred: approve and merge #7 first (it changes no production application code), then reconcile #8 onto that updated main using this reviewed implementation, keeping both scripts and one provenance object. Rerun every check on that new head before approving #8. Do not take “ours” or “theirs” for the shared fixtures. A plain copy of #7 into #8 without recording the ancestry still produces overlapping-edit conflicts when merged sequentially.

Neither route is authorized for execution by this review. Original PR heads and main remain untouched. Production was observed at main commit `f6a04ef3c5e8158b0b30f659d43e77571948d428`; no production deployment is requested. Hosted-provider smoke verification with explicitly isolated test storage remains outstanding.
