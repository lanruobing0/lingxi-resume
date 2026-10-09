import assert from "node:assert/strict";
import { captchaRefreshBeforeExpiryMs, shouldRefreshCaptcha } from "../src/captchaState.js";

const issuedAt = 1_000_000;
assert.equal(shouldRefreshCaptcha(0, issuedAt + captchaRefreshBeforeExpiryMs), false, "missing challenge must wait for explicit retry");
assert.equal(shouldRefreshCaptcha(issuedAt, issuedAt + captchaRefreshBeforeExpiryMs - 1), false, "fresh challenge must remain stable while the user types");
assert.equal(shouldRefreshCaptcha(issuedAt, issuedAt + captchaRefreshBeforeExpiryMs), true, "challenge must refresh before the five-minute server expiry");
assert.equal(shouldRefreshCaptcha(issuedAt, issuedAt + captchaRefreshBeforeExpiryMs + 60_000), true, "stale challenge must refresh when the page regains focus");

console.log("captcha lifecycle tests passed");
