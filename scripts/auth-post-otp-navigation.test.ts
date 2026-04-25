import assert from "node:assert/strict";
import { shouldUseHardNavigationAfterOtp } from "../lib/auth/auth-redirect";

assert.equal(
  shouldUseHardNavigationAfterOtp({
    nextPath: "/create",
  }),
  true,
);

assert.equal(
  shouldUseHardNavigationAfterOtp({
    nextPath: "/",
  }),
  true,
);

assert.equal(
  shouldUseHardNavigationAfterOtp({
    nextPath: "/me",
  }),
  true,
);

assert.equal(
  shouldUseHardNavigationAfterOtp({
    nextPath: "/g/game-on-d606f65c/play",
    linkPlayerId: "player-123",
  }),
  false,
);

assert.equal(
  shouldUseHardNavigationAfterOtp({
    nextPath: "/g/game-on-d606f65c/play",
  }),
  false,
);

console.log("auth post-OTP navigation checks passed");
