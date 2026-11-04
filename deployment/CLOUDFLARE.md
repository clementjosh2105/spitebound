# Free deployment: Spitebound

The frontend runs on Cloudflare Pages. Supabase provides authentication, cloud progress, and the shared campaign leaderboard. The local Node/SQLite server is not deployed to Pages.

## 1. Create the backend

1. Create a free Supabase project.
2. In its SQL editor, run [`supabase/schema.sql`](../supabase/schema.sql) once for a new project. It includes the 60-level campaign, private per-user progress, and combined leaderboard.
3. Copy the project's HTTPS URL and **publishable** key from the project Connect panel.
4. Put these public values in `.env.local` (which is ignored by source control):

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Do not use a secret or service-role key. The build validates the key type before creating a Pages bundle.

## 2. Publish the game

Use Node 24 or newer:

```sh
npm ci
npx wrangler login
npx wrangler pages project create spitebound --production-branch main
npm run deploy:pages
```

If `spitebound` is unavailable, choose an available project name and update `wrangler.jsonc` and the `deploy:pages` command accordingly. Wrangler reports the actual deployed URL; do not assume the project name is available.

The command builds the frontend with the Supabase configuration, then uploads only `dist/`. It does not upload the local database, account files, or environment files.

For a Cloudflare Pages project connected to a Git repository, use:

- Build command: `npm run build:pages`
- Build output directory: `dist`
- Node version: 24 (`.node-version` is included)
- Production environment variables: the two public Supabase values above

## 3. Configure authentication for the deployed URL

In Supabase → Authentication → URL Configuration, set Site URL to the actual HTTPS Pages URL and add that URL to the redirect allowlist. Add the custom-domain URL too if one is used. Configure email confirmation/password-reset email delivery in Supabase according to the intended signup flow.

## 4. Verify the live deployment

Register a new account, sign in, complete a level, and refresh to confirm cloud progress. Open another browser and verify the same player appears in the campaign leaderboard at the matching difficulty. Check logout and password recovery on the hosted origin.

The existing local SQLite accounts and scores are not automatically copied into Supabase. Migration needs a separate plan because Supabase uses its own account IDs and authentication password format. Keep the local database intact.

## Current local prerequisites

Publishing requires access to the user's Cloudflare account and a provisioned Supabase project. A normal `npm run build` still supports the existing Node/SQLite deployment; `npm run build:pages` refuses missing Supabase configuration so Pages does not accidentally ship an app that calls a nonexistent `/api` backend.

References: [Cloudflare direct upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [Supabase React setup](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
