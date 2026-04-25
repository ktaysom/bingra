import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || /^\s*#/.test(line)) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);

async function time(label, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    console.log(
      JSON.stringify({
        label,
        durationMs: Date.now() - startedAt,
        ok: !result?.error,
        data: result?.data ?? null,
        error: result?.error ?? null,
      }),
    );
    return result;
  } catch (error) {
    console.log(
      JSON.stringify({
        label,
        durationMs: Date.now() - startedAt,
        ok: false,
        thrown: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}

const createResult = await time("rpc_create_game_full", () =>
  supabase.rpc("rpc_create_game_full", {
    p_title: `codex-lock-diagnostic-${Date.now()}`,
    p_sport: "soccer",
    p_mode: "quick_play",
    p_host_display_name: "Codex Host",
    p_allow_custom_cards: true,
    p_visibility: "private",
    p_completion_mode: "BLACKOUT",
    p_end_condition: "FIRST_COMPLETION",
    p_team_a_name: "Team A",
    p_team_b_name: "Team B",
    p_team_scope: "both_teams",
    p_events_per_card: 5,
    p_sport_profile: "soccer",
    p_catalog_version: "v1",
    p_auth_user_id: null,
    p_account_id: null,
  }),
);

const createdRow = Array.isArray(createResult.data) ? createResult.data[0] : createResult.data;

if (!createdRow?.game_slug || !createdRow?.host_player_id) {
  process.exit(1);
}

await time("lock_player_card_invalid_call", () =>
  supabase.rpc("lock_player_card", {
    p_player_id: "00000000-0000-0000-0000-000000000000",
    p_game_slug: "missing-game",
    p_target_count: 1,
    p_selection_mode: "custom",
    p_card_cells: [
      {
        event_key: "test:event",
        event_label: "Test Event",
        team_key: null,
        point_value: 1,
        threshold: 1,
        order_index: 0,
        is_lock: true,
      },
    ],
  }),
);

await time("lock_player_card_valid_call", () =>
  supabase.rpc("lock_player_card", {
    p_player_id: createdRow.host_player_id,
    p_game_slug: createdRow.game_slug,
    p_target_count: 5,
    p_selection_mode: "custom",
    p_card_cells: [
      {
        event_key: "goal",
        event_label: "Goal",
        team_key: null,
        point_value: 3,
        threshold: 1,
        order_index: 0,
        is_lock: true,
      },
      {
        event_key: "assist",
        event_label: "Assist",
        team_key: null,
        point_value: 2,
        threshold: 1,
        order_index: 1,
        is_lock: false,
      },
      {
        event_key: "shot_on_target",
        event_label: "Shot on Target",
        team_key: null,
        point_value: 1,
        threshold: 1,
        order_index: 2,
        is_lock: false,
      },
      {
        event_key: "corner",
        event_label: "Corner",
        team_key: null,
        point_value: 1,
        threshold: 1,
        order_index: 3,
        is_lock: false,
      },
      {
        event_key: "yellow_card",
        event_label: "Yellow Card",
        team_key: null,
        point_value: 1,
        threshold: 1,
        order_index: 4,
        is_lock: false,
      },
    ],
  }),
);
