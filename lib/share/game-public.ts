import { createSupabaseAdminClient } from "../supabase/admin";
import { cache } from "react";

export type PublicGameShareData = {
  id: string;
  slug: string;
  title: string | null;
  sportProfile: string | null;
  teamAName: string;
  teamBName: string;
};

type GameRow = {
  id: string;
  slug: string;
  title: string | null;
  sport_profile: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
};

export const getPublicGameShareDataBySlug = cache(async (slug: string): Promise<PublicGameShareData | null> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, slug, title, sport_profile, team_a_name, team_b_name")
    .eq("slug", slug)
    .maybeSingle<GameRow>();

  if (error || !data) {
    return null;
  }

  const result = {
    id: data.id,
    slug: data.slug,
    title: data.title,
    sportProfile: data.sport_profile,
    teamAName: data.team_a_name?.trim() || "Team A",
    teamBName: data.team_b_name?.trim() || "Team B",
  };

  return result;
});