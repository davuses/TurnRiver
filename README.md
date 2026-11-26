# TurnRiver — 6-Max Texas Hold'em Training Studio

[Open TurnRiver](https://davuses.github.io/TurnRiver/)

**TurnRiver** is an interactive 6-max 100bb No-Limit Texas Hold'em training studio designed to help players make independent decisions at the table. Practice preflop ranges, spoiler-free postflop decision drills (including paired river bet-size comparisons), pot odds & Call EV math, multi-street hand reading, and full cash-game hands against configurable strategic bots on an integrated 3D WebGL casino poker table.

---

## Core Features

TurnRiver is organized into **5 primary modules** plus a persistent **Leak Tracker** (with the interactive 3D WebGL Poker Table unified directly inside the Multi-Bot Arena):

- **Preflop Range & Position Lab** — 6-max 100bb RFI, 3-bet, and 4-bet defense drills with an interactive 169-hand mixed-strategy reference matrix and frequency-based grading.
- **Postflop Live-Table Trainer** — 16 curated spots: Flop, turn, and river single-raised and 3-bet pot spots with spoiler-free prompts, a decisive-detail step, a paired river bet-size comparison drill (33% vs 125% pot), and hand-number breakdowns.
- **Pot Odds, Equity & EV Math Lab** — Pot odds (graded in percentage points), exact flop & turn equity enumeration, Call EV in big blinds, bluff break-even %, and Minimum Defense Frequency (MDF) drills.
- **Hand Reading & Range Narrowing** — 6 multi-street spots: Paint Villain's surviving range onto a 13×13 matrix street-by-street and score range overlap (%), precision, and recall.
- **3D Multi-Bot Practice Arena** — Play complete cash hands against up to 6 distinct bot archetypes (*Balanced Reg, TAG, LAG, Calling Station, Nit, Maniac*) on a custom Three.js PBR WebGL casino table (5 camera presets, spatial WebAudio SFX, BB/$ stakes, Theater & Fullscreen modes, optional 2D Classic view):
  - **Real Poker-Room Rules & Controls:** Configurable table size (Heads-Up to 6-Max), stack depths (50/100/200bb), **Antes** (`0.1bb` / `0.25bb`), **UTG Straddle** (`2bb` live option), **Run It Twice** all-in split runouts, **Rabbit Hunt**, uncontested **Show Hand**, **Pre-Action Checkboxes** (`Check / Fold`, `Auto-Check`), main & side-pot showdown payouts, Hero position lock, dynamic sizing presets, and Fast-Fold.
  - **Pro Training Tools:** **RNG 1–100 Randomizer** chip, configurable **Coach Mode** (*Off*, *After Hand*, or *Live Alert* with instant **Undo & Retry**), **Hand History Replay** with **Flashback ("Play From Here")** sandbox branches, and **PokerStars-compatible `.txt` Hand History** copy & session download.
  - **Persistent Session, Scouting & Challenges:** Persistent **Bankroll & SVG Session P&L Graph** (`BB/100`, lifetime Hero HUD stats), clickable **Opponent Scouting Popovers** (extended `C-Bet` / `Fold to C-Bet` / `WTSD` / `AF` stats, color tags, persistent notes, and **Blind-Read Archetype Guess** quiz), and built-in **Arena Challenges**.
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

### Bot Arena (3D Table & Controls)

| Key | Action |
| :--- | :--- |
| `1` – `5` | Switch camera presets (*Hero POV, Broadcast, Top-Down, Pot Close-Up, Rail Shot*) |
| `H` | Show / hide 3D studio controls dock |
| `P` | Toggle ambient lounge props (crystal whiskey tumbler & gold card protector) |
| `M` | Mute / unmute 3D table audio SFX |
| `Esc` | Exit Bot Arena Theater Mode or close open Arena modals |

### Preflop Lab & Bot Arena Actions

| Key | Action |
| :--- | :--- |
| `F` | Fold |
| `C` / `Space` | Check / Call |
| `R` | Bet / Raise / Open / 3-Bet / 4-Bet |
| `Enter` | Deal next hand after showdown / grading |
