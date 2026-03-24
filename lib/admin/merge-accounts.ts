import { createSupabaseAdminClient } from "../supabase/admin";
import { rebuildCareerStatsFromCanonicalHistory } from "../bingra/rebuild-career-stats";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type MergeAccountsParams = {
  sourceAccountId: string;
  targetAccountId: string;
  dryRun?: boolean;
  mergedByAuthUserId?: string | null;
  metadata?: Record<string, JsonValue>;
  rebuildAfterApply?: boolean;
};

export type MergeAccountsResult = {
  ok: boolean;
  dryRun: boolean;
  mergePlan?: Record<string, JsonValue>;
  mergeId?: string;
  alreadyMerged?: boolean;
  rebuild?: {
    rebuiltProfileCount: number;
    rebuiltGameResultCount: number;
  };
  raw: Record<string, JsonValue>;
};

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, JsonValue> {
  return isRecord(value) ? value : {};
}

export async function mergeAccounts(params: MergeAccountsParams): Promise<MergeAccountsResult> {
  const sourceAccountId = params.sourceAccountId?.trim();
  const targetAccountId = params.targetAccountId?.trim();

  if (!sourceAccountId || !targetAccountId) {
    throw new Error("sourceAccountId and targetAccountId are required");
  }

  if (sourceAccountId === targetAccountId) {
    throw new Error("Cannot merge an account into itself");
  }

  const supabase = createSupabaseAdminClient();
  const dryRun = params.dryRun ?? true;
  const rebuildAfterApply = params.rebuildAfterApply ?? true;

  const { data, error } = await supabase.rpc("admin_merge_accounts", {
    p_source_account_id: sourceAccountId,
    p_target_account_id: targetAccountId,
    p_dry_run: dryRun,
    p_merged_by_auth_user_id: params.mergedByAuthUserId ?? null,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  const raw = asRecord(data);
  const ok = Boolean(raw.ok);

  if (!ok) {
    throw new Error(`Merge failed: ${JSON.stringify(raw)}`);
  }

  const result: MergeAccountsResult = {
    ok,
    dryRun,
    mergePlan: asRecord(raw.merge_plan),
    mergeId: typeof raw.merge_id === "string" ? raw.merge_id : undefined,
    alreadyMerged: Boolean(raw.already_merged),
    raw,
  };

  if (!dryRun && rebuildAfterApply) {
    // Aggregates are intentionally cleared during merge apply; rebuild to restore canonical totals.
    result.rebuild = await rebuildCareerStatsFromCanonicalHistory({
      supabase,
      profileIds: [targetAccountId],
    });
  }

  return result;
}
