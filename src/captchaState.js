export const captchaRefreshBeforeExpiryMs = 4 * 60 * 1000;

export function shouldRefreshCaptcha(issuedAt, currentTime = Date.now()) {
  const issued = Number(issuedAt);
  return Number.isFinite(issued) && issued > 0 && currentTime - issued >= captchaRefreshBeforeExpiryMs;
}
