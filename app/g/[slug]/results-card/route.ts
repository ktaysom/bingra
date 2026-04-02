import { ImageResponse } from "next/og";
import { createElement } from "react";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { buildGameScores } from "../../../../lib/bingra/game-results";
import { normalizeCardCells, type CompletionMode, type RecordedEvent } from "../../../../lib/bingra/card-progress";
import { resolveSportProfileKey } from "../../../../lib/bingra/sport-profiles";

export const runtime = "nodejs";

function sanitizeLabel(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 50);
}

type GameRow = {
  id: string;
  slug: string;
  winner_player_id: string | null;
  completion_mode: CompletionMode;
  sport_profile: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
};

type PlayerRow = {
  id: string;
  display_name: string;
  created_at: string | null;
};

type CardRow = {
  player_id: string;
  accepted_at: string | null;
  card_cells: Array<{
    event_key: string | null;
    team_key: string | null;
    order_index: number;
    point_value: number | null;
    threshold?: number | null;
  }>;
};

type ScoredEventRow = {
  event_key: string | null;
  team_key: string | null;
  created_at: string | null;
};

type CompletionRow = {
  player_id: string;
  created_at: string;
};

function extractSlug(pathname: string): string | null {
  const match = pathname.match(/^\/g\/([^/]+)\/results-card$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function medalForIndex(index: number): string {
  if (index === 0) {
    return "🥇";
  }
  if (index === 1) {
    return "🥈";
  }
  return "🥉";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = extractSlug(url.pathname);

  let teamA = sanitizeLabel(url.searchParams.get("teamA"), "Team A");
  let teamB = sanitizeLabel(url.searchParams.get("teamB"), "Team B");
  let winner = sanitizeLabel(url.searchParams.get("winner"), "Winner");
  let score = sanitizeLabel(url.searchParams.get("score"), "—");
  let raw = sanitizeLabel(url.searchParams.get("raw"), "—");
  let hasBingra = url.searchParams.get("bingra") === "1";
  let playerCount = 0;
  let leaderboardTopThree: Array<{ name: string; finalScore: number }> = [];

  if (slug) {
    const supabase = createSupabaseAdminClient();
    const { data: game } = await supabase
      .from("games")
      .select("id, slug, winner_player_id, completion_mode, sport_profile, team_a_name, team_b_name")
      .eq("slug", slug)
      .maybeSingle<GameRow>();

    if (game) {
      const [{ data: players }, { data: cards }, { data: scoredEvents }, { data: completions }] =
        await Promise.all([
          supabase
            .from("players")
            .select("id, display_name, created_at")
            .eq("game_id", game.id)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .returns<PlayerRow[]>(),
          supabase
            .from("cards")
            .select("player_id, accepted_at, card_cells(event_key, team_key, order_index, point_value, threshold)")
            .eq("game_id", game.id)
            .returns<CardRow[]>(),
          supabase
            .from("scored_events")
            .select("event_key, team_key, created_at")
            .eq("game_id", game.id)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .returns<ScoredEventRow[]>(),
          supabase
            .from("game_completions")
            .select("player_id, created_at")
            .eq("game_id", game.id)
            .returns<CompletionRow[]>(),
        ]);

      const safePlayers = players ?? [];
      const safeCards = cards ?? [];
      const safeEvents = scoredEvents ?? [];
      const safeCompletions = completions ?? [];
      playerCount = safePlayers.length;

      const recordedEvents: RecordedEvent[] = safeEvents.map((event) => ({
        event_key: event.event_key,
        team_key: event.team_key,
        created_at: event.created_at,
      }));

      const bingraPlayerIds = new Set(safeCompletions.map((completion) => completion.player_id));
      const bingraCompletedAtByPlayerId = new Map<string, string>();
      for (const completion of safeCompletions) {
        const existing = bingraCompletedAtByPlayerId.get(completion.player_id);
        if (!existing || completion.created_at < existing) {
          bingraCompletedAtByPlayerId.set(completion.player_id, completion.created_at);
        }
      }

      const leaderboard = buildGameScores({
        players: safePlayers.map((player) => ({
          id: player.id,
          display_name: player.display_name,
          created_at: player.created_at,
        })),
        cards: safeCards.map((card) => ({
          player_id: card.player_id,
          accepted_at: card.accepted_at,
          card_cells: normalizeCardCells(
            (card.card_cells ?? []).map((cell) => ({
              event_key: cell.event_key,
              team_key: cell.team_key,
              order_index: cell.order_index,
              point_value: cell.point_value,
              threshold: cell.threshold,
            })),
          ),
        })),
        recordedEvents,
        completionMode: game.completion_mode,
        sportProfile: resolveSportProfileKey(game.sport_profile),
        bingraPlayerIds,
        bingraCompletedAtByPlayerId,
      });

      const winnerEntry = game.winner_player_id
        ? leaderboard.find((entry) => entry.player_id === game.winner_player_id) ?? leaderboard[0] ?? null
        : leaderboard[0] ?? null;

      if (winnerEntry) {
        winner = sanitizeLabel(winnerEntry.player_name, winner);
        score = sanitizeLabel(String(winnerEntry.final_score), score);
        raw = sanitizeLabel(String(winnerEntry.raw_points), raw);
        hasBingra = winnerEntry.has_bingra;
      }

      teamA = sanitizeLabel(game.team_a_name, teamA);
      teamB = sanitizeLabel(game.team_b_name, teamB);
      leaderboardTopThree = leaderboard.slice(0, 3).map((entry) => ({
        name: sanitizeLabel(entry.player_name, "Player"),
        finalScore: entry.final_score,
      }));
    }
  }

  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "radial-gradient(circle at 20% 15%, #1d4ed8 0%, #1e293b 42%, #0f172a 100%)",
          color: "#ffffff",
          padding: "56px",
          fontFamily: "Inter, Arial, sans-serif",
          border: "8px solid #60a5fa",
        },
      },
      createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 14 } },
        createElement(
          "div",
          {
            style: {
              alignSelf: "flex-start",
              backgroundColor: "rgba(96, 165, 250, 0.18)",
              border: "2px solid rgba(147, 197, 253, 0.65)",
              borderRadius: "999px",
              padding: "8px 18px",
              fontSize: 20,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              fontWeight: 700,
            },
          },
          "Bingra Results",
        ),
        createElement(
          "div",
          { style: { fontSize: 66, fontWeight: 850, lineHeight: 1.02, letterSpacing: -1 } },
          `${teamA} vs ${teamB}`,
        ),
      ),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: 16,
          },
        },
        createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "22px 24px",
              borderRadius: "22px",
              backgroundColor: "rgba(15, 23, 42, 0.56)",
              border: "1px solid rgba(148, 163, 184, 0.5)",
              width: "58%",
            },
          },
          createElement("div", { style: { fontSize: 36, fontWeight: 800 } }, `🏆 Winner: ${winner}`),
          createElement(
            "div",
            { style: { fontSize: 30, opacity: 0.96, fontWeight: 600 } },
            `Final score: ${score}`,
          ),
          createElement(
            "div",
            { style: { fontSize: 24, opacity: 0.95, fontWeight: 600 } },
            `Raw score: ${raw}${hasBingra ? " · Bingra x2" : ""}`,
          ),
        ),
        createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "18px 20px",
              borderRadius: "20px",
              backgroundColor: "rgba(15, 23, 42, 0.56)",
              border: "1px solid rgba(148, 163, 184, 0.5)",
              width: "42%",
            },
          },
          createElement("div", { style: { fontSize: 24, fontWeight: 800, letterSpacing: 0.4 } }, "Leaderboard"),
          ...(leaderboardTopThree.length > 0
            ? leaderboardTopThree.map((entry, index) =>
                createElement(
                  "div",
                  {
                    key: `${entry.name}-${index}`,
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 21,
                      fontWeight: 600,
                      opacity: 0.95,
                    },
                  },
                  createElement(
                    "span",
                    null,
                    `${medalForIndex(index)} ${index + 1}. ${entry.name}`,
                  ),
                  createElement("span", { style: { fontWeight: 800 } }, `${entry.finalScore}`),
                ),
              )
            : [
                createElement(
                  "div",
                  { key: "no-leaderboard", style: { fontSize: 19, opacity: 0.8 } },
                  "Leaderboard data unavailable",
                ),
              ]),
          createElement(
            "div",
            { style: { marginTop: 6, fontSize: 18, opacity: 0.85, fontWeight: 600 } },
            `${playerCount > 0 ? playerCount : leaderboardTopThree.length} players competed`,
          ),
        ),
      ),
      createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "flex-start",
          },
        },
        createElement(
          "div",
          { style: { fontSize: 26, opacity: 0.95, fontWeight: 700 } },
          "Play Bingra",
        ),
        createElement(
          "div",
          { style: { fontSize: 20, opacity: 0.78, letterSpacing: 0.6, textTransform: "lowercase" } },
          "bingra.com",
        ),
      ),
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}