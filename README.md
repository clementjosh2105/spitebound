# Spitebound

A 60-level browser platformer with six worlds, a winding level map, three difficulty modes, and twelve boss encounters. Built with React, TypeScript, Vite, and Phaser 3. Art is drawn locally without asset downloads.

## Run

```sh
npm install
npm run dev
```

`npm run build` creates `dist/`; `npm run preview` serves it. `npm test` checks campaign configuration, save recovery and migration, progression, difficulty records, and ordered seal mechanics.

## Play

Login is the first screen. Sign in, register, or explicitly continue as a guest before entering the game. Guest identity survives refresh in the current tab; signing out ends it. Registered players load progress and preferences from the backend database on login, with a per-user browser backup for interrupted connections. Existing browser saves migrate into the account on login. Guest progress stays on the device. Switching identities resets the active run. Home, level map, and gameplay are separate screens. Playing fills the viewport with the game and a compact HUD; use Pause → Back to level selection to return to the map. The desktop fullscreen button expands the game further.

Ground movement uses quicker acceleration and braking, with responsive air steering. Gravity and jump strength are tuned together to preserve jump height. Arrow keys or A/D move; Space jumps. W / Up climbs ladders; S / Down descends. Away from ladders, W / Up also jumps. Phone ladder levels have separate climb-up and climb-down buttons. R retries; Escape pauses. Phones have touch buttons; landscape is recommended. Losing focus pauses gameplay. The world map scrolls horizontally on small screens. Select an unlocked node, choose difficulty, and start. Next Level and retries retain the selected difficulty.

Every five-level section ends with a boss, at levels **5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, and 60**. Boss encounters have four objectives: floor seals, airborne weak points that require jumping, moving lights that must be caught, and timed survival barrages with no seals. Each has three phases. The boss label and level hint explain its objective. Later bosses use different seal orders and accelerate their strikes. Defeat the boss to unlock its exit. Retry resets the encounter.

## Worlds

- **Welcome to Hell (1–10):** falling floors, identical fake doors, hidden spikes, reversed controls, fake checkpoints, invisible walls, jump-triggered traps, and moving exits. Bosses: The Gift Goblin and First Nightmare.
- **Mind Games (11–20):** bait buttons, misleading advice, temporary control reversals, rhythmic hazards, switches that require backtracking, and multiple fake exits. Bosses: The Floor Warden and Brain Meltdown.
- **Total Chaos (21–30):** climbable invisible blocks, timed crossings, celebration-door traps, multiple falling floors, control zones, moving doors, and a final ambush. Bosses: The Betrayal King and Ultimate Troll.

- **Paradox Palace (31–40):** chained switches, crate backtracking, ceiling routes, pursuit, and deceptive floors. Bosses: The Glass Monarch and The Paradox Engine.

Levels have fixed solutions. Hidden spike traps remain invisible before activation; collapsing floor sections have no visible seams. Hints explain each route, and death messages explain what to learn. Numbered switches must be activated in order; purple zones reverse controls only while inside their boundaries.

- **Skyworks (41–50):** ladder climbs, elevators, staircase jumps, spring launches, horizontal ferries, conveyors, timed lasers, key detours, and a multi-floor skyshaft. Bosses: The Lift Inspector and The Sky Marshal.
- **Clockwork Citadel (51–60):** lift transfers, laser galleries, switchback towers, chained springs, diagonal ferries, conveyor stairs, and the Clock Tower. Bosses: The Clockmaker and The Last Mechanism.

Blue moving platforms carry the player. Orange springs launch automatically on landing; mint arrows show conveyor direction. Bright red lasers are lethal, dark beams are safe, and a faint beam warns that the next pulse is near. Gold keys unlock marked exits. The completion screen shows the finished level number, name, stars, campaign count, and next level number. Finishing old level 40 unlocks level 41 without resetting saves.

## Difficulty and saves

Easy offers narrower spikes, earlier warnings, longer floor-collapse delays, more forgiving jump input, and slower boss strikes. Hard adds a faster moving skull, tighter trap timing, faster lifts and conveyors, short laser openings, and a visible countdown. “Better kill yourself” adds two fast moving skulls to the original worlds, later spike triggers, near-instant floor collapses, precise jump input, four-volley boss attacks, faster machinery, half-second laser openings, tighter deadlines, and no checkpoints. Boss arenas use their own attack system rather than the generic difficulty skulls. Hard bosses fire three targeted volleys before exposing a seal; Nightmare bosses fire four. Each volley targets the player’s latest position, so keep moving until the seal opens. Hard and Nightmare show seconds remaining in the HUD. Running out of time ends the attempt with an explicit message; pausing stops the countdown. Easy retains the learning routes without a deadline. Fixed skull patterns in other levels remain in every mode, with adjusted speed.

Level unlocking is shared; personal records are separate per difficulty. Legacy saves and completed level 5/10 records migrate without a reset. Three stars require a death-free run below the level's par time; two require at most two deaths. Time measures the current attempt; deaths accumulate across retries until selecting a new level. Best time, deaths, and stars are independent records. The backend stores registered players’ unlocked levels, total deaths, stars, personal records per difficulty, and preferences. Saves merge achievements so stale device snapshots cannot remove unlocks or better records; preferences use the latest save. Browser local storage provides a per-user backup and guest saves; guest play works if storage is unavailable. Progress sync failures show a retry action.

## Architecture and verification

`src/game/levels.ts` defines handcrafted configurations and world metadata. `difficulty.ts` derives mode-specific settings without mutating source data. `TrapScene.ts` runs reusable traps, control zones, ordered puzzles, moving hazards, and boss strikes. `boss.ts` handles ordered seal contact. `src/components/LevelMap.tsx` renders the campaign paths and accessible selection buttons. React owns the HUD, dialogs, settings, and touch controls. Phaser uses a responsive high-resolution canvas over a 960×540 design space at 80% camera zoom, making the character and obstacles smaller while showing more space. In-game labels use smooth, high-resolution sans-serif text; sprite textures retain pixel-art filtering. Tall stages scroll vertically with the player.

The production build and automated tests verify types, configuration, and progression; they do not replace real gameplay testing. The browser route suite checks all 180 level/difficulty combinations. Real-device controls, human difficulty feedback, and Safari audio still need release testing. Ads, skins, and deployment remain future work; online accounts and rankings work through the built-in Node server by default. Optional Google Fonts fall back to system fonts when offline.

## Online accounts and leaderboard

**No external account configuration is needed.** `npm run dev` starts the game and a built-in account API. Register through Log in → Create an account, then complete levels while signed in. Accounts, password hashes, sessions, campaign progress, preferences, run tokens, and scores persist in `.data/troll.sqlite`, outside the browser. Other browsers connected to the same server see the same rankings. Session restoration and logout are implemented; guest play remains available.

The campaign leaderboard combines all levels into one row per player, with a difficulty filter and no level dropdown. It ranks the top 50 by levels completed (descending), total best time (ascending), then total deaths (ascending). Equal totals share a rank. Each level contributes its best submitted run once; replaying a level cannot increase the completed count. Slower runs cannot replace a player's faster time. Checkpoint retries keep their accumulated level time. Account, ranking-load, and score-submission errors appear in red; success messages retain their usual color. Failed score submissions can be retried from the completion screen using the same run token. If the run could not connect when it started, replay the level to submit a score. Scores remain client-reported: the server checks ownership, one-time run tokens, numeric bounds, and elapsed server time, but does not perform tamper-proof replay validation.

Passwords use salted scrypt (`N=32768, r=8, p=3`), one of the [OWASP recommended configurations](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Sessions use random HttpOnly/SameSite cookies; only token hashes are stored in SQLite. Server/database files cannot be downloaded through the development server. Signup and login are rate-limited, and cross-site JSON writes are rejected.

Builtin registration creates an account immediately; email verification and reset-email delivery are not enabled. Password help displays that limitation clearly. Supabase remains optional: setting both public Vite Supabase variables in `.env.local` selects it instead. For that provider, run `supabase/schema.sql` for a new installation, or `supabase/expand-to-60.sql` for an existing installation (includes cloud-save and campaign leaderboard support). Already upgraded installations need `supabase/campaign-leaderboard.sql`. Configure Auth email delivery and redirects for Supabase. See [Supabase authentication documentation](https://supabase.com/docs/guides/auth/passwords).

### Free hosting with Cloudflare Pages and Supabase

See [the free deployment guide](deployment/CLOUDFLARE.md). Run `npm run build:pages` to validate the public Supabase configuration and build a static bundle. `npm run deploy:pages` builds and uploads it to Cloudflare after account authentication. Backend provisioning and live verification require your Supabase and Cloudflare access.

### Run on a public host

Use Node **24 or newer** and persistent storage:

```sh
npm install
npm run build
npm start
```

`npm start` serves both `dist/` and the account API on port 8080. `PORT`, `HOST`, and `TROLL_DB_PATH` can override the defaults. Mount `.data/` on a persistent volume and back it up; do not put it in a public asset directory. For public deployment, use HTTPS with `NODE_ENV=production` so session cookies carry the Secure flag. A reverse proxy should preserve the original Host header. A static-only host cannot run this built-in API. `npm run preview` also includes the API for local build checks.

### Test online behavior

`npm run test:api` verifies account persistence across restarts, password hashing, cookies, logout, score ordering, record ownership, single-use runs, and request protections. Browser tests use a separate in-memory database and verify actual registration, login, refresh, logout, and a leaderboard visible from another browser; they never populate the real account database with test players.

## Added mechanics and polish

- Real checkpoints in levels 3, 13, 19, 26, 32, and 37. Retry respawns at the saved flag and retains elapsed time; Pause → Restart from beginning clears it. Blue flags look alike, including the fake checkpoint in level 6.
- Levels 13 and 37 have an inverted-gravity zone with a ceiling route. Stop at the checkpoint to settle onto the floor before the final jump.
- Levels 17 and 38 require pushing a crate onto its pad. The crate suppresses the spike strip and locks on its pad. Jump over it on the return trip.
- Levels 24 and 39 have a pursuing hazard. Difficulty adjusts its speed.
- Twelve boss encounters with eight attack patterns: aimed, paired, sweeping lanes, crossfire, three-lane shockwaves, mixed final phases, echo strikes, and spiraling lanes. Bosses have different colors and a visible health bar.
- First-play tutorial, replayable controls guide, and dismissible phone landscape prompt.
- Procedural walk animation, running dust, death particles, world scenery, and synthesized music for each world. Music and sound settings are independent. Audio starts after a play gesture and stops when leaving gameplay.

## Browser verification

```sh
npx playwright install chromium
npm run test:browser
```

This runs real Chromium checks for menu/map/game separation, onboarding, phone touch controls, the landscape prompt, and real account/leaderboard flows. The route harness exercises all **180 level/difficulty combinations** with actual Phaser Arcade physics, a fixed 60Hz clock, and input-only controls. It uses full configuration knowledge to find learned solutions; it does not teleport players or disable traps. The generated `artifacts/gameplay-verification.json` records every result and a hash of engine/configuration inputs. The harness is served only by the development server; Vite's production build does not include it.

Passing these checks demonstrates reachable routes and catches runtime interactions; it does not establish first-time discovery, player enjoyment, or fair difficulty on every device. Human feedback, real Android/iOS hardware, Firefox/Safari testing, and deployed-domain/email-delivery verification remain release checks.

The custom lime adventurer icon is used by the game header, browser favicon, and mobile home-screen metadata. The new Spitebound name preserves existing accounts and browser saves; legacy storage keys and the database path remain compatible.
