# Data Model

## games
- id
- slug
- title
- mode (quick_play | streak)
- status (lobby | live | finished)
- created_at

## game_events
- id
- game_id
- event_key
- event_label
- point_value

## players
- id
- game_id
- display_name
- role (host | scorer | player)
- join_token

## cards
- id
- game_id
- player_id
- current_progress_index (for streak mode)

## card_cells
- id
- card_id
- event_key
- event_label
- point_value
- order_index (nullable)
- marked_at
- is_lock (boolean)

## scored_events
- id
- game_id
- event_key
- created_at
- sequence_number

## winners
- id
- game_id
- player_id
- claimed_at
- verified_at
- is_first_claim

## player_stats
- id
- player_id
- career_points
- games_played
- wins