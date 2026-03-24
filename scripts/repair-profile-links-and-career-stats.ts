import { createSupabaseAdminClient } from "../lib/supabase/admin";
import { backfillHostProfileLinksFromGamesAuthUserId } from "../lib/auth/repair-player-links";
import { rebuildCareerStatsFromCanonicalHistory } from "../lib/bingra/rebuild-career-stats";

async function main() {
  const supabase = createSupabaseAdminClient();

  const hostBackfill = await backfillHostProfileLinksFromGamesAuthUserId();

  const rebuild = await rebuildCareerStatsFromCanonicalHistory({
    supabase,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        hostBackfill,
        rebuild,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );

  process.exitCode = 1;
});
