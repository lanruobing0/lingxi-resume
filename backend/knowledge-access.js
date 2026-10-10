// Legacy documents without scope are public. Unknown scopes fail closed.
export const isPublicKnowledge = (document) => document.scope === undefined || document.scope === "PUBLIC";
export const isOwnedKnowledge = (document, userId) => document.scope === "PRIVATE" && Number.isInteger(userId) && document.userId === userId;
export const canReadKnowledge = (document, userId = null) => isPublicKnowledge(document) || isOwnedKnowledge(document, userId);

export function sanitizePersonalKnowledge(value, user = {}) {
  let text = String(value || "");
  const identities = [user.realName, user.username, user.email, user.phone, user.website, user.city, ...(user.materialIdentities || [])].filter((item) => typeof item === "string" && item.trim().length >= 2);
  for (const identity of identities) text = text.split(identity).join("[已隐藏个人信息]");
  return text
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/gi, "[已隐藏图片数据]")
    .replace(/"(?:api_?key|token|password|session)"\s*:\s*"[^"]*"/gi, '"私密字段":"[已隐藏]"')
    .replace(/^\s*(?:姓名|名字|Name|邮箱|邮件|Email|电话|手机|Phone|网站|Website|住址|地址|城市|City|微信|身份证)\s*[:：].*$/gim, "[已隐藏个人信息]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[已隐藏邮箱]")
    .replace(/(?:https?:\/\/|www\.)[^\s)）<>]+/gi, "[已隐藏网址]")
    .replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, "[已隐藏电话]")
    .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g, "[已隐藏证件号码]")
    .replace(/\b(?:sk-|Bearer\s+)[A-Za-z0-9_-]{8,}\b/gi, "[已隐藏密钥]")
    .replace(/(?:api[_ -]?key|token|password|密码|密钥)\s*[:=：]\s*[^\s,，;；]+/gi, "[已隐藏密钥]");
}
