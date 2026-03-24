import { mergeAccounts } from "../lib/admin/merge-accounts";

type CliOptions = {
  sourceAccountId: string;
  targetAccountId: string;
  dryRun: boolean;
  mergedByAuthUserId: string | null;
  rebuildAfterApply: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const options: CliOptions = {
    sourceAccountId: "",
    targetAccountId: "",
    dryRun: true,
    mergedByAuthUserId: null,
    rebuildAfterApply: true,
  };

  while (args.length > 0) {
    const token = args.shift();
    if (!token) continue;

    if (token === "--source") {
      options.sourceAccountId = args.shift() ?? "";
      continue;
    }

    if (token === "--target") {
      options.targetAccountId = args.shift() ?? "";
      continue;
    }

    if (token === "--apply") {
      options.dryRun = false;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--merged-by") {
      options.mergedByAuthUserId = args.shift() ?? null;
      continue;
    }

    if (token === "--skip-rebuild") {
      options.rebuildAfterApply = false;
      continue;
    }
  }

  return options;
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  npm run merge:accounts -- --source <source_account_id> --target <target_account_id> [--dry-run]",
      "  npm run merge:accounts -- --source <source_account_id> --target <target_account_id> --apply [--merged-by <auth_user_id>]",
      "",
      "Notes:",
      "  - Default mode is --dry-run",
      "  - --apply performs transaction-safe merge + career rebuild",
      "  - --skip-rebuild disables post-merge rebuild (not recommended)",
    ].join("\n"),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.sourceAccountId || !options.targetAccountId) {
    printUsage();
    throw new Error("Missing --source or --target");
  }

  const result = await mergeAccounts({
    sourceAccountId: options.sourceAccountId,
    targetAccountId: options.targetAccountId,
    dryRun: options.dryRun,
    mergedByAuthUserId: options.mergedByAuthUserId,
    rebuildAfterApply: options.rebuildAfterApply,
    metadata: {
      invoked_from: "scripts/merge-accounts.ts",
      mode: options.dryRun ? "dry-run" : "apply",
    },
  });

  console.log(JSON.stringify({ ok: true, result }, null, 2));
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
