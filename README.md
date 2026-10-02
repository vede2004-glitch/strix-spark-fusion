# Stirix.ro

Román hír-aggregátor: magyar és román felület, több forrásból gyűjtött hírek,
AI-összesített cikkek és cikkoldali AI kérdezz-felelek.

## Miben fut?

- React 19 + TanStack Start (Vite) – frontend és szerver funkciók
- Tailwind CSS v4 – stílusok (`src/styles.css`)
- Python (`weboldalparolás.py`) – RSS gyűjtés, GitHub Actions futtatja
  5 percenként (`.github/workflows/scraper.yml`)

## Hol mit szeressz?

| Ha ezt akarod módosítani | Ez a fájl |
| --- | --- |
| Főoldal elrendezése, hírsávok | `src/routes/index.tsx` |
| Cikkoldal | `src/routes/hir.$id.tsx` |
| AI kérdezz-felelek a cikkoldalban | `src/components/ArticleQA.tsx` |
| AI végpont, modell, kulcs beolvasása | `src/routes/api/ask.ts` |
| Kategóriák, forrásszűrők, nyelvkezelés | `src/lib/news.ts`, `src/lib/lang.ts` |
| Menü (jobb oldali felugyi) | `src/components/SiteMenu.tsx` |
| Támogatás / beküldés / visszajelzés / források / rólunk | `src/routes/tamogatas.tsx`, `bekuldes.tsx`, `visszajelzes.tsx`, `forrasok.tsx`, `rolunk.tsx` |
| Színek, betűtípusok, fényes/sötét téma | `src/styles.css` |
| Hírek anyaga | `src/data/news.json` |
| Logó, favicon | `public/stirix-logo.png`, `public/favicon.png` |
| RSS források listája | `weboldalparolás.py` |

## AI beállítása

A chat nem hardkódolt kulccsal dolgozik: négy környezeti változót olvassa.
Részletes leírás és példa: [`.env.example`](.env.example).

| Változó | Mit jelent |
| --- | --- |
| `AI_GATEWAY_URL` | Az AI végpont alapcíme (a `/v1`-ig) |
| `AI_GATEWAY_API_KEY` | A kulcs, amit az a végpont vár |
| `AI_GATEWAY_MODEL` | Modellazonosító |
| `AI_GATEWAY_PROTOCOL` | `responses` vagy `chat` |

Vercelen: **Settings → Environment Variables**, majd redeploy.
Lovable-ban: **Project Settings → Secrets**.

## Helyi futtatás

```bash
bun install
bun run dev
```

Nyisd meg a http://localhost:8080 címet.

Titkok helyileg: hozz létre egy `.env` fájlt a fenti változókkal – a
`.gitignore` miatt a GitHubra nem kerül fel.
