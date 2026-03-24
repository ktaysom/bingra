import test from "node:test";
import assert from "node:assert/strict";
import { parseAccountLinkIntentValue } from "../lib/auth/account-link-intent-payload";

test("parseAccountLinkIntentValue returns account id for fresh payload", () => {
  const payload = JSON.stringify({
    accountId: "11111111-1111-1111-1111-111111111111",
    createdAt: Date.now(),
  });

  const result = parseAccountLinkIntentValue(payload);
  assert.deepEqual(result, { accountId: "11111111-1111-1111-1111-111111111111" });
});

test("parseAccountLinkIntentValue returns null for stale payload", () => {
  const payload = JSON.stringify({
    accountId: "11111111-1111-1111-1111-111111111111",
    createdAt: Date.now() - 1000 * 60 * 30,
  });

  const result = parseAccountLinkIntentValue(payload);
  assert.equal(result, null);
});

test("parseAccountLinkIntentValue returns null for malformed payload", () => {
  assert.equal(parseAccountLinkIntentValue("not-json"), null);
  assert.equal(parseAccountLinkIntentValue(JSON.stringify({ createdAt: Date.now() })), null);
});
