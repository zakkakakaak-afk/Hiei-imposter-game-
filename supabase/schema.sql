-- Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null,
  category text,
  round_number integer not null default 0,
  status text not null default 'lobby' check (status in ('lobby','active')),
  created_at timestamptz not null default now()
);
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(room_id,user_id)
);
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  user_id uuid not null,
  role text not null check (role in ('normal','imposter','mr_white')),
  word text,
  category text not null,
  unique(room_id,round_number,user_id)
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.assignments enable row level security;

-- Room/roster data is visible to signed-in guest players. Secret assignments are private.
drop policy if exists "room metadata read" on public.rooms;
create policy "room metadata read" on public.rooms for select to authenticated using (true);
drop policy if exists "player roster read" on public.players;
create policy "player roster read" on public.players for select to authenticated using (true);
drop policy if exists "own assignment only" on public.assignments;
create policy "own assignment only" on public.assignments for select to authenticated using (auth.uid() = user_id);

grant select on public.rooms, public.players, public.assignments to authenticated;
-- All writes are performed by the Edge Function using the service role key.
-- Do not expose the service role key in the website or NEXT_PUBLIC environment variables.

-- Enable Realtime for room/player changes in Database > Publications if it is not already enabled.
