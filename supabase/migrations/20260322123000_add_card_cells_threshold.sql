-- Add threshold support for card cells.
-- Safe for existing data and repeatable deploys.

alter table public.card_cells
add column if not exists threshold integer;

update public.card_cells
set threshold = 1
where threshold is null;

alter table public.card_cells
alter column threshold set default 1;

alter table public.card_cells
alter column threshold set not null;
