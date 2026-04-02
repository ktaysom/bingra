# Bingra Results Sharing QA Checklist

Use this checklist when you have a **public finished game slug**.

## 1) Prepare a test game

- [ ] Create a Bingra game
- [ ] Complete the game so it reaches **finished** state
- [ ] Capture the slug

Test URL format:

`https://bingra.com/g/[slug]/results`

---

## 2) Verify page loads publicly

Open in an incognito/private browser:

`https://bingra.com/g/[slug]/results`

Confirm:

- [ ] Winner name is displayed
- [ ] Final score is displayed
- [ ] Raw score is displayed
- [ ] Bingra multiplier appears when applicable
- [ ] Leaderboard section renders

---

## 3) Verify CTAs

Confirm CTA presence and behavior:

- [ ] **Primary CTA:** `Create Your Own Bingra` → `/create`
- [ ] **Secondary CTA:** `Go to Bingra Home` → `/`
- [ ] Any link to `/g/[slug]/play` is visually secondary

---

## 4) Verify metadata on `/g/[slug]/results`

View page source and confirm tags:

- [ ] `og:title`
- [ ] `og:description`
- [ ] `og:image`
- [ ] `twitter:card` = `summary_large_image`
- [ ] `twitter:image`

Confirm `og:image` is an **absolute public URL** (not localhost).

Expected pattern:

`https://bingra.com/g/[slug]/results-card?teamA=...&teamB=...&winner=...&score=...`

---

## 5) Verify OG image endpoint directly

Open the `og:image` URL directly.

Confirm:

- [ ] Image loads successfully
- [ ] Winner is visible
- [ ] Final score is visible
- [ ] Raw score is visible
- [ ] Bingra indicator is visible when applicable

---

## 6) Verify social unfurl

- [ ] Facebook: https://developers.facebook.com/tools/debug/
- [ ] X: https://cards-dev.twitter.com/validator
- [ ] iMessage/Slack: paste URL and confirm card unfurl

If stale:

- [ ] Re-scrape with Facebook debugger
- [ ] Confirm metadata/og:image values match current page source

---

## 7) Confirm crawler accessibility

Run:

```bash
curl -I "https://bingra.com/g/[slug]/results-card"
```

Confirm:

- [ ] HTTP 200 (or successful public response)
- [ ] No auth barrier

---

## 8) Validate Vercel preview behavior

Repeat checks with preview URL:

`https://<preview-domain>/g/[slug]/results`

Confirm:

- [ ] OG metadata present
- [ ] OG image loads
- [ ] Facebook/X unfurl correctly

---

## QA report template

- Slug tested:
- Results URL:
- `og:title`:
- `og:description`:
- `og:image`:
- `twitter:image`:
- OG image HTTP status:
- Facebook unfurl status:
- X unfurl status:
- iMessage/Slack unfurl status:
- Winner modal vs OG image discrepancies:
- Notes / final recommendation:
