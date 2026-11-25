# TurnRiver — 6-Max Texas Hold'em Training Studio

[Open TurnRiver](https://davuses.github.io/TurnRiver/)

**TurnRiver** is an interactive 6-max 100bb No-Limit Texas Hold'em training studio designed to help players make independent decisions at the table. Practice preflop ranges, spoiler-free postflop decision drills (including paired river bet-size comparisons), pot odds & Call EV math, multi-street hand reading, and full hands against configurable strategic bots on an interactive 3D casino poker table.

---

## Core Features

- **Preflop Range & Position Lab** — 6-max 100bb RFI, 3-bet, and 4-bet defense drills with an interactive 169-hand mixed-strategy reference matrix and frequency-based grading.
- **Postflop Live-Table Trainer** — 16 curated spots: Flop, turn, and river single-raised and 3-bet pot spots with spoiler-free prompts, a decisive-detail step, a paired river bet-size comparison drill (33% vs 125% pot), and hand-number breakdowns.
- **Pot Odds, Equity & EV Math Lab** — Pot odds (graded in percentage points), exact flop & turn equity enumeration, Call EV in big blinds, bluff break-even %, and Minimum Defense Frequency (MDF) drills.
- **Hand Reading & Range Narrowing** — 6 multi-street spots: Paint Villain's surviving range onto a 13×13 matrix street-by-street and score range overlap (%), precision, and recall.
- **Configurable Multi-Bot Practice Arena** — Play complete cash hands against up to 6 distinct bot archetypes (*Balanced Reg, TAG, LAG, Calling Station, Nit, Maniac*) with customizable table size (Heads-Up to 6-Max), stack depths, main & side-pot showdown payouts, Hero position lock, live HUD stats, Blind Read mode, Fast-Fold, street-by-street pot-odds reviews, and **Theater / Fullscreen Mode**.
- **Zero-Flash 3D WebGL Poker Table** — Salon obsidian/baize UI around a custom Three.js PBR casino table: mahogany racetrack trim, stitched leather rail, speed-cloth felt themes, lighting presets, animated dealing and chip tossing, fold mucking, check ripples, felt-printed bet/pot labels, toggleable lounge props, and 5 camera angles (*Hero POV, Broadcast, Top-Down, Pot Close-Up, Rail Shot*).
- **Spatial Casino Audio** — Positional WebAudio SFX for cards, chips, checks, and folds (mute with M).
- **Hand History Replay** — Step back through completed Bot Arena hands street by street.
- **Dynamic Sizing Presets** — Context-aware preflop and postflop bet/raise size presets in the Arena.
- **Training Review & Leak Tracker** — Aggregates accuracy, average score (`/ 100`), streaks, and per-drill native metrics across all modules with automatic local browser persistence (`localStorage`).
- **Bilingual Support** — Instant toggle between **English (`en`)** and **Simplified Chinese (`zh-CN`)**.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons (100% client-side, zero backend or API keys required)
- **3D Engine:** Three.js (procedural canvas textures, PBR lighting, instanced clay chips, parabolic deal/bet tweens)
- **Storage:** Browser `localStorage`

---

## Local Development

### Prerequisites
- Node.js 22.12+ (Node 24 recommended; matches CI)

### Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Type-check with TypeScript (strict mode)
npm run lint

# Run unit tests (poker engine & i18n parity)
npm test

# Build static production bundle into dist/
npm run build

# Remove build output directory
npm run clean

# Preview production build locally
npm run preview
```

---

## Deployment

TurnRiver builds into a pure static Single-Page Application (`dist/`) with relative asset paths (`base: './'`), ready for GitHub Pages or any static host.

### GitHub Pages (Automated via GitHub Actions)
This repository includes `.github/workflows/deploy-pages.yml`.

1. Push your repository to GitHub (`main` or `master` branch).
2. In your GitHub repo, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Wait for the **Deploy TurnRiver to GitHub Pages** workflow in the **Actions** tab to finish.

### Embedding in Google Sites
1. Open [sites.google.com](https://sites.google.com).
2. Go to **Pages** → hover **`+`** → **Full page embed** → **Add embed → By URL**.
3. Paste your live GitHub Pages URL (`https://davuses.github.io/TurnRiver/`) and click **Publish**.

---

## Keyboard Shortcuts

### 3D Table & Bot Arena

| Key | Action |
| :--- | :--- |
| `1` – `5` | Switch camera presets (*Hero POV, Broadcast, Top-Down, Pot Close-Up, Rail Shot*) |
| `H` | Show / hide 3D studio controls dock |
| `P` | Toggle ambient lounge props (crystal whiskey tumbler & gold card protector) |
| `M` | Mute / unmute 3D table audio SFX |
| `Esc` | Exit Bot Arena Theater Mode or close the Arena setup modal |

### Preflop Lab & Bot Arena actions

| Key | Action |
| :--- | :--- |
| `F` | Fold |
| `C` | Call (when facing an open or 3-bet) |
| `R` | Raise / Open / 3-Bet / 4-Bet |
| `Enter` | Deal next hand after grading |
