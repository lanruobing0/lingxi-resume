// Preserve provider-safe resume metadata while removing contact details embedded in prose.
export function filterWritingContext(value, resume) {
  if (Array.isArray(value)) return value.map(item => filterWritingContext(item, resume));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, filterWritingContext(item, resume)]));
  if (typeof value !== "string") return value;
  let text = value;
  const privateValues = [resume.realName, resume.email, resume.phone, resume.website, resume.city, ...(resume.profileFields || []).map(field => field.value)];
  for (const field of privateValues.filter(field => typeof field === "string" && field.trim())) text = text.split(field).join("[已移除个人信息]");
  return text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[已移除邮箱]").replace(/https?:\/\/\S+/gi, "[已移除链接]").replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, "[已移除电话]");
}
