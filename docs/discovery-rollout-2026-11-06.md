# Discovery and inquiry improvements — 6 November 2026

Unconfirmed storage returns failure. Atomic membership/token/bonus write; confirmed persistence required before conversion or reward. Contact conversion waits for provider acceptance.

Validation: 5 focused subscription API/client tests. No production customer messages were sent during these checks.

This update does not establish increased traffic, search placement, AI mentions or sales. A before/after comparison requires comparable observed data. Self-reported discovery sources, where offered, are optional and are not proof of causation.

## Preservation baseline and CI

The Gothic workflow initially stopped at the historic `api/subscribe.js` hash after this rollout. `contact.html` also had an intentionally changed hash. The preservation fixture now records only these two reviewed application-file updates from commit `7c1c24253ba9a1872802e641342cf0f909060082`; every other baseline entry, including all original artwork and printable PDFs, remains unchanged. Both updated application files remain hash-checked rather than excluded from preservation checks.

Run `npm run --prefix tests test:subscribe` for the five focused signup API/client tests. The Gothic workflow now runs this command before the existing deck, Gothic-print and original-print checks, and triggers on changes to the signup API, home page and contact page as well as the existing print/test paths. These local tests use mocked storage and mail responses and do not submit production signups or verify actual inbox delivery.
