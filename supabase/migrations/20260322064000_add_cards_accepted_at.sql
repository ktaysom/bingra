ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_cards_game_player_accepted_at
  ON public.cards (game_id, player_id, accepted_at);