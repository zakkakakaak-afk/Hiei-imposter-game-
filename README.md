# Imposter website starter

A mobile-first 3–12 player secret-word game. Players join from a room code or invite link. The game privately assigns words; discussion happens on Discord. There is no in-site voting.

## Rules implemented
- 3–5 players: 1 impostor, no Mr. White.
- 6–8 players: 1 impostor, 1 Mr. White.
- 9–12 players: 2 impostors, 1 Mr. White.
- Normal players share one word.
- Impostors share a different related word.
- Mr. White receives no word and no hint.
- Only the room creator can start a round / next round.
- Categories: Countries, Anime, Football, Food, Gaming.

## Important
This is the source project, not a published live website. To make the link work for friends, configure Supabase and deploy the Next.js project to Vercel. You only need accounts for GitHub, Supabase and Vercel. Friends do not need accounts.

## Setup (phone or computer)
1. Create a Supabase project at https://supabase.com.
2. In Supabase Authentication > Providers, enable **Anonymous sign-ins**.
3. Open SQL Editor, paste all of `supabase/schema.sql`, and run it.
4. In Supabase Project Settings > API, copy the Project URL and anon/public key.
5. In the Supabase Edge Functions area / CLI, deploy the function in `supabase/functions/game`. Set the Edge Function secret `SUPABASE_SERVICE_ROLE_KEY` to the project's service-role key. Keep this key secret; never put it in `.env` or any `NEXT_PUBLIC_` variable.
6. In GitHub, create a repository and upload the contents of this folder.
7. In Vercel, import the GitHub repository. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables, then deploy.
8. In Supabase Database > Publications, enable Realtime for `rooms` and `players` if the project does not already publish them.

## Notes / limitations
- This is an initial playable foundation, not a fully hardened commercial service.
- The word pairs are an editable starter list. Expand and review them before public launch.
- A round can be started by the host. Players joining after a round starts are blocked; the host can create a fresh room for a new group.
- The UI refreshes room state periodically so it works even if Realtime is not enabled.
- Add room expiry, abuse protection, reconnection polish and production monitoring before a large public release.
