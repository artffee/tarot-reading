# The Cat Priestess — Tarot & Oracle

A dark, luxe online tarot reading site with an AI oracle named **Bastet**.
Live at **https://www.thecatpriestess.com**

She does not predict — she reflects.

## Features
- **Free readings** — Daily Draw, Past · Present · Path, and a five-card Inner Journey.
- **34-card custom deck** (art by IVOSART) with a gallery at `/deck` and a page for every card.
- **"Bastet Speaks"** written interpretations, plus a live **AI chat oracle** (Google Gemini via a Vercel serverless function, with Groq / Anthropic / OpenAI fallbacks).
- **Installable PWA** with offline support (service worker).
- **SEO** — structured data (JSON-LD), sitemap, robots, FAQ; Google Analytics.
- **Ko-fi donations** and a **Contact / Book a Reading** page.

## Stack
- Static **HTML / CSS / JS** — no framework, no build step.
- **Vercel** hosting + one serverless function (`/api/bastet`).
- Card art optimized to **WebP**.

## Project layout
```
index.html            # home: hero, reading tool, FAQ, Bastet chat
about.html            # /about — the myth, the deck, the maker
contact.html          # /contact — booking + message form
deck/                 # /deck gallery + 34 per-card pages
api/bastet.js         # AI oracle endpoint (reads GEMINI_API_KEY etc.)
cards/                # card art (WebP) + card back
icons/                # PWA icons
sw.js                 # service worker (offline)
manifest.webmanifest  # PWA manifest
sitemap.xml, robots.txt
vercel.json           # clean URLs + headers
```

## Develop & deploy
- It's a static site — serve the folder locally, or just open `index.html`.
- Deploy: `vercel --prod`
- **Bastet AI** requires an API key set as a Vercel environment variable
  (`GEMINI_API_KEY`, or `GROQ_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`).
  Without one, Bastet falls back to graceful in-character canned replies.

## Credit
Deck artwork and site by **IVOSART** — an independent artist working between Sofia and Florida.
