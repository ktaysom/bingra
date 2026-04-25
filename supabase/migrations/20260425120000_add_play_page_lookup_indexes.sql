BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_slug_unique
  ON public.games (slug);

CREATE INDEX IF NOT EXISTS idx_card_cells_card_id_order_index
  ON public.card_cells (card_id, order_index);

COMMIT;
