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
  const result = await fn();
  console.log(
    JSON.stringify({
      label,
      durationMs: Date.now() - startedAt,
      error: result.error?.message ?? null,
      count: Array.isArray(result.data) ? result.data.length : result.count ?? (result.data ? 1 : 0),
    }),
  );
  return result;
}

await time("games-count", () => supabase.from("games").select("*", { head: true, count: "exact" }));
await time("players-count", () => supabase.from("players").select("*", { head: true, count: "exact" }));
await time("cards-count", () => supabase.from("cards").select("*", { head: true, count: "exact" }));
await time("card-cells-count", () => supabase.from("card_cells").select("*", { head: true, count: "exact" }));
await time("blocked-queries", () => supabase.rpc("debug_blocked_queries"));
