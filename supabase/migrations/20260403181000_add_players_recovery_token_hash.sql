alter table public.players
add column if not exists recovery_token_hash text;

create index if not exists players_recovery_token_hash_idx
  on public.players (recovery_token_hash)
  where recovery_token_hash is not null;
