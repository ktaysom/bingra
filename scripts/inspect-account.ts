import { inspectAccountById } from "../lib/admin/inspect-account";

function parseAccountId(argv: string[]): string {
  const args = [...argv];
  while (args.length > 0) {
    const token = args.shift();
    if (token === "--account") {
      return args.shift() ?? "";
    }
  }

  return "";
}

function printUsage() {
  console.log("Usage: npm run inspect:account -- --account <account_id>");
}

async function main() {
  const accountId = parseAccountId(process.argv.slice(2));
  if (!accountId) {
    printUsage();
    throw new Error("Missing --account");
  }

  const inspection = await inspectAccountById(accountId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        accountId,
        inspection,
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
