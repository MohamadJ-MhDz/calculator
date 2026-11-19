# Brand verification — what is known, what is not

## Result

**Unverified.** No official colour value, typeface or logo of 3ramic could be confirmed, so none
is used or claimed in the film. `src/config/brand.ts` records `verification.status: "unverified"`
and every `colors.*` value is `null`; `npm run validate` fails if a colour is set while the brand
is unverified, and if the rejected orange `#FF703D` appears anywhere in the source.

## What was tried (2026-11-15 / 16)

| Attempt | Result |
|---|---|
| `https://3ramic.ir/fa`, `https://www.3ramic.ir/fa` | Allowed by this environment's proxy, but the site's server reset the connection during the TLS handshake (TLS 1.2 and 1.3, with and without a browser user-agent). |
| Web search for the brand | No result from or about the site. |
| Archived copy (web.archive.org) | Could not be reached: adding that host to this environment's network allowlist was refused by the environment service. |
| Assets supplied with the brief | None — no logo file, brand guide, screenshot or colour codes were attached. |

## What the film does instead

- All 2D graphics (subtitles, suspect tags, compare labels, brand card) use a neutral ink `#15181C`
  on paper `#F5F2EC`. These are **not** presented as 3ramic colours.
- Story-world colours (the cherry vanity, the busy pattern, the oak, the greige wall tiles) belong
  to the bathroom set, not to the brand.
- The brand name is set as plain text («3ramic» in the film's text face) in the logo slot. It is a
  placeholder, not a designed mark.
- The written name is always `3ramic`; the spoken name is always «سه‌رامیک» (/serˈɑmik/).
- Positioning stays factual: 3ramic is presented as the place to see coordinated tile models
  («مدل‌های هماهنگ رو ببین» + `3ramic.ir`). No prices, guarantees, partnerships or "makes every
  room bigger" claims; the compare says only «همون ۶ متر» (the same 6 m²).

## To finish the brand (about two minutes)

1. Put the official logo in `public/` — SVG, or PNG with transparency (the version for a light background).
2. In `src/config/brand.ts` set `logo.file` (e.g. `"3ramic-logo.svg"`) and adjust `logo.width`.
3. Fill `colors.primary`, `colors.background`, `colors.text` (and `accent` if the guide has one)
   with the official hex values and set `verification.status` to `"verified"`.
4. `npm run validate`, then `npm run studio` to check the end card, then render.

The logo is shown untouched (no recolouring, no distortion), with clear space of 12 % of its width.
