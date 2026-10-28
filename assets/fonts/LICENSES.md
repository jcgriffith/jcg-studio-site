# Font licenses

Both families are licensed under the **SIL Open Font License 1.1**. Each full license text sits next to its font file.

| File | Family | Source | License |
|---|---|---|---|
| `Archivo-VF.woff2` | Archivo (Omnibus-Type) | github.com/google/fonts — `ofl/archivo/Archivo[wdth,wght].ttf` | OFL 1.1 — `OFL-Archivo.txt` |
| `DepartureMono-Regular.woff2` | Departure Mono v1.500 (Helena Zhang) | github.com/rektdeckard/departure-mono releases | OFL 1.1 — `OFL-DepartureMono.txt` |

## Modifications (permitted by OFL; Reserved Font Names not used for derivatives)

Downloaded 2026-09-29 and subset with fontTools (`pyftsubset`) to Basic Latin + Latin-1, general punctuation, arrows, box drawing, block elements, and geometric shapes, then output as woff2. Archivo was also instanced with `fontTools varLib.instancer` to `wdth` 100–125 and `wght` 400–700. The family names are unchanged; these are web-delivery subsets, not renamed derivatives.

## Mak (mak-bold.woff2)
Mak Bold by Valentyn Tkachenko, version 2.003. The font's own licence field reads "Free for personal and commercial use". Subset to basic Latin for the web (2026-10-22); used for the 719 Studios loft names and poster.

## Bricolage Grotesque and DM Sans (2026-10-27, self-hosted for the 719 Studios case study)
Both are SIL OFL 1.1 (Google Fonts: ofl/bricolagegrotesque, ofl/dmsans). The latin woff2 files that fonts.googleapis.com serves were instanced with `fontTools varLib.instancer` (Bricolage `wght` 300–800; DM Sans `wght` 400–800) and subset with `pyftsubset` to Basic Latin, Latin-1 and common punctuation and arrows. Family names are unchanged. They replace the two render-blocking Google Fonts stylesheets.
