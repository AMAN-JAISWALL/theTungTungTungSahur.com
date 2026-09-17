# The Tung Tung Tung Sahur

Source for [thetungtungtungsahur.com](https://thetungtungtungsahur.com): a hub of free Tung Tung Tung Sahur browser games, built with Astro 7 and Tailwind CSS v4. The first game is **Find Tung Tung Tung Sahur**, an audio hide-and-seek game in a dark village.

The visual system follows `../DESIGN.md` (Geist type scale, hairline cards, pill vs 6px buttons, one mesh gradient), moved onto a night canvas.

## Commands

| Command          | Action                                                   |
| :--------------- | :------------------------------------------------------- |
| `npm install`    | Install dependencies                                     |
| `npm run dev`    | Start the dev server at `localhost:4321`                 |
| `npm run build`  | Build the static site to `./dist/`                       |
| `npm run check`  | Type-check the project                                   |
| `npm run images` | Re-render the favicon, app icons and OG images in `public/` |

`npm run images` uses system fonts for text. For on-brand text, set `OG_FONT_DIR` to a folder containing Geist and Geist Mono `.ttf` files.

## The Game

- **Classic**: one hide at a time, no timer.
- **Sahur Rush**: 40 seconds to dawn. Catches score points, add time and build a combo; misses cost 3 seconds. He starts wandering at level 4, pot-banging decoys join at level 6.
- **Daily Sahur**: 5 seeded hides, the same for everyone that day, with a streak and a shareable emoji grid.
- Golden Sahur appears now and then (a bell in his knock, double points). Ranks grow with total finds.

The sound is synthesized with the Web Audio API: knocks get louder, brighter, higher and faster as you get closer, pan left/right toward him, and turn into a drumroll when you're on him. Visual cues (a lantern that heats up and a heat meter) switch on when sound is off or blocked. It plays with a mouse, touch (drag, then lift or tap) and the keyboard.

## Structure

```text
src/
├── site.ts                 Site constants, nav and the games list (live + coming soon)
├── layouts/Layout.astro    SEO head: title, description, canonical, Open Graph, JSON-LD
├── pages/                  /, /games, /games/find-tung-tung-tung-sahur, /about, /privacy, 404
├── components/
│   ├── find/FindGame.astro Game menu and the full-screen game dialog
│   ├── NightScene.astro    Sky, stars, moon and village skyline
│   ├── Sahur.astro         The character (original art)
│   └── …                   Header, Footer, GameCard, Breadcrumbs, Faq, PageHeader, Logo, GameIcon
├── lib/
│   ├── art.ts              Character, logo, moon and skyline SVG (shared with the image script)
│   ├── random.ts           Seeded RNG and string hash
│   └── schema.ts           JSON-LD helpers
├── scripts/find/
│   ├── engine.ts           Game loop, input, rounds, scoring, lantern rendering
│   ├── audio.ts            Web Audio synthesis
│   ├── modes.ts            Mode rules, difficulty ramp, ranks, daily numbering
│   ├── store.ts            localStorage progress and settings
│   └── main.ts             Menu wiring
└── styles/                 global.css (tokens, components), find.css (game)
scripts/generate-images.ts  Renders public/favicon.svg, icons and og/*.png
```

## Adding a Game

Add an entry to `GAMES` in `src/site.ts` (set `status: 'live'` and `href`) and create its page under `src/pages/games/`. Coming-soon games only need the entry.
