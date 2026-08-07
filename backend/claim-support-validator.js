export const claimSupportVersion = "claim-support-v4";
export const minimumSemanticCoverage = 0.55;
export const minimumCitationClauseCoverage = 0.2;

const boilerplate = /知识资料|资料建议|建议使用|建议通过|建议展示|建议在|使用|通过|展示|呈现|共同|以及|进行|同时|的|了|和|与|中|在|对|将/g;
const userAttribution = /(用户|候选人|候选者|该候选者|简历持有人|简历作者|应聘者|该应聘者|求职者|申请人|本人|其本人|用户简历(?:展示|证明)?|该简历|当前简历)|(?:^|[，,。.;；:：?？!！\s])(?:他|她)(?=(?:已|已经|正在|将|负责|拥有|具备|掌握|完成|实现|提高|提升|证明))/;
const adviceLanguage = /(建议|应当|应该|应(?=[\u4e00-\u9fff])|(?:^|[，。；、\s])应(?:$|[，。；、\s])|可考虑|可以|可(?=[\u4e00-\u9fff])|(?:^|[，。；、\s])可(?:$|[，。；、\s])|可能|有助于|通常需要|通常|需注意|需要关注)/;
const factEscalation = /(已经|已(?:经)?|显著|完成|达到|提升|证明|具备|精通|掌握|拥有|负责|一定|必然|已实现|已解决|已满足|充分证明)/;
const negativeLanguage = /(不足以|未达到|不支持|未支持|不能|不可|不具备|不应|无|非|未|不)/;
const conclusionLanguage = /(因此|从而|导致|提升|实现|证明|说明|支撑|效果显著|必然|已(?:经)?|完成|具备|拥有|负责|满足|解决)/;
const parallelConnector = /和|以及|同时|共同|并|与/;
const causalConnector = /(因此|从而|导致|实现(?:了)?|带来(?:了)?|说明)/;
const resultLanguage = /(提升|提高|效果|结果|实现|带来)/;
const latinToken = /[a-z][a-z0-9+#.\-]*/gi;
const numberToken = /\d+(?:\.\d+)?(?:%|％|年|个月|倍|ms|秒|次|项|万|k)?/gi;

function normalize(value) {
  return String(value || "").toLocaleLowerCase("en-US").replace(/\r\n?/g, "\n").replace(/[\s\p{P}\p{S}]+/gu, "");
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function extractLatin(value) { return unique((String(value || "").match(latinToken) || []).map((item) => item.toLocaleLowerCase("en-US"))); }
function extractNumbers(value) { return unique((String(value || "").match(numberToken) || []).map((item) => item.toLocaleLowerCase("en-US"))); }

function cjkNgrams(value) {
  const compact = normalize(value).replace(boilerplate, "");
  const groups = compact.match(/[\u4e00-\u9fff]+/g) || [];
  const output = [];
  for (const group of groups) for (let size = 2; size <= 4; size += 1) for (let index = 0; index + size <= group.length; index += 1) output.push(group.slice(index, index + size));
  return unique(output);
}

function coverage(value, quote) {
  const terms = cjkNgrams(value);
  const quoteTerms = new Set(cjkNgrams(quote));
  return terms.length ? Number((terms.filter((term) => quoteTerms.has(term)).length / terms.length).toFixed(4)) : 1;
}

function splitClauses(value) { return String(value || "").split(/[，,；;。！？!?]+/).map((item) => item.trim()).filter(Boolean); }

function hasCausalConnector(value) {
  return causalConnector.test(String(value || "").replace(/共同说明/g, ""));
}

function removeParallelBoilerplate(value) {
  return String(value || "").replace(/^(?:知识资料建议|知识资料|资料建议|建议通过|建议使用|建议展示|建议|通过|使用|展示)+/, "").trim();
}

function parallelSupport(claimText, quotes) {
  const claim = String(claimText || "");
  const explicitlyParallel = parallelConnector.test(claim) && !hasCausalConnector(claim);
  if (!explicitlyParallel) return { explicitlyParallel: false, supported: false, units: [], unitCoverage: [] };
  const units = unique(claim.replace(/共同说明[^。！？；]*/g, "").split(/和|以及|同时|共同|并|与/).map(removeParallelBoilerplate).filter(Boolean));
  const unitCoverage = units.map((unit) => ({ unit, coverage: coverage(unit, quotes.join("\n")) }));
  return { explicitlyParallel: true, supported: units.length >= 2 && unitCoverage.every((item) => item.coverage >= minimumCitationClauseCoverage), units, unitCoverage };
}

function metrics(claimText, quotes) {
  const joined = quotes.join("\n");
  const entities = extractLatin(claimText);
  const numbers = extractNumbers(claimText);
  const claimTerms = cjkNgrams(claimText);
  const quoteTerms = new Set(cjkNgrams(joined));
  const supportedTerms = claimTerms.filter((term) => quoteTerms.has(term));
  const clauses = splitClauses(claimText);
  const parallel = parallelSupport(claimText, quotes);
  return {
    citationCount: quotes.length,
    claimEntityCount: entities.length,
    claimNumberCount: numbers.length,
    claimTermCount: claimTerms.length,
    supportedTermCount: supportedTerms.length,
    semanticCoverage: claimTerms.length ? Number((supportedTerms.length / claimTerms.length).toFixed(4)) : 1,
    perCitationCoverage: quotes.map((quote) => coverage(claimText, quote)),
    clauseCoverage: clauses.map((clause) => ({ clause, perCitation: quotes.map((quote) => coverage(clause, quote)) })),
    parallelUnits: parallel.units,
    parallelUnitCoverage: parallel.unitCoverage,
    parallelSupported: parallel.supported,
    quoteEntities: extractLatin(joined), quoteNumbers: extractNumbers(joined), entities, numbers,
  };
}

function failure(code, supportMetrics) { return { supported: false, claimSupportVersion, supportStatus: "UNSUPPORTED", supportFailureCode: code, supportMetrics }; }

function hasUnsupportedTail(claimText, quotes, resultMetrics) {
  const normalizedClaim = normalize(claimText);
  for (let index = 0; index < quotes.length; index += 1) {
    const normalizedQuote = normalize(quotes[index]);
    if (!normalizedQuote || !normalizedClaim.includes(normalizedQuote) || normalizedClaim === normalizedQuote) continue;
    const residualClaim = normalizedClaim.replace(normalizedQuote, "");
    const otherQuotes = quotes.filter((_, quoteIndex) => quoteIndex !== index).join("\n");
    if (!otherQuotes || coverage(residualClaim, otherQuotes) < minimumSemanticCoverage) return true;
  }
  return resultMetrics.clauseCoverage.slice(1).some(({ clause, perCitation }) => conclusionLanguage.test(clause) && Math.max(...perCitation) < minimumSemanticCoverage);
}

function hasCrossCitationInference(claimText, quotes, resultMetrics) {
  if (quotes.length < 2) return false;
  if (hasCausalConnector(claimText)) return true;
  if (resultMetrics.parallelUnits.length) return !resultMetrics.parallelSupported;
  const clauses = splitClauses(claimText);
  const leadingEntities = extractLatin(clauses[0]);
  const resultClauses = clauses.slice(1).filter((clause) => resultLanguage.test(clause));
  if (leadingEntities.length && resultClauses.length && leadingEntities.some((entity) => quotes.some((quote) => quote.toLocaleLowerCase("en-US").includes(entity)) && quotes.some((quote) => resultClauses.some((clause) => coverage(clause, quote) >= minimumCitationClauseCoverage) && !quote.toLocaleLowerCase("en-US").includes(entity)))) return true;
  if (resultMetrics.perCitationCoverage.some((value) => value < minimumCitationClauseCoverage)) return true;
  const hasCausalLink = conclusionLanguage.test(claimText);
  if (!hasCausalLink || clauses.length < 2) return false;
  const firstEntities = extractLatin(clauses[0]);
  const laterResult = clauses.slice(1).some((clause) => conclusionLanguage.test(clause));
  if (!laterResult) return false;
  return firstEntities.some((entity) => quotes.some((quote) => quote.toLocaleLowerCase("en-US").includes(entity)) && quotes.some((quote) => conclusionLanguage.test(quote) && !quote.toLocaleLowerCase("en-US").includes(entity)));
}

export function validateClaimSupport({ claimText, citations, localQuotes }) {
  const quotes = unique((localQuotes || citations?.map((citation) => citation.quote) || []).map((quote) => String(quote || "").trim()));
  const resultMetrics = metrics(claimText, quotes);
  const claim = String(claimText || "");
  if (!quotes.length) return failure("INSUFFICIENT_SEMANTIC_OVERLAP", resultMetrics);
  if (userAttribution.test(claim)) return failure("UNSUPPORTED_USER_ATTRIBUTION", resultMetrics);
  if (resultMetrics.numbers.some((number) => !resultMetrics.quoteNumbers.includes(number))) return failure("UNSUPPORTED_NUMBER", resultMetrics);
  if (resultMetrics.entities.some((entity) => !resultMetrics.quoteEntities.includes(entity))) return failure("UNSUPPORTED_ENTITY", resultMetrics);
  const quoteText = quotes.join("\n");
  if (hasCrossCitationInference(claim, quotes, resultMetrics)) return failure("UNSUPPORTED_CROSS_CITATION_INFERENCE", resultMetrics);
  if (hasUnsupportedTail(claim, quotes, resultMetrics)) return failure("UNSUPPORTED_CLAIM_EXTENSION", resultMetrics);
  if (negativeLanguage.test(quoteText) !== negativeLanguage.test(claim)) return failure("POLARITY_MISMATCH", resultMetrics);
  if (adviceLanguage.test(quoteText) && factEscalation.test(claim)) return failure("POLARITY_MISMATCH", resultMetrics);
  if (!resultMetrics.parallelSupported && resultMetrics.semanticCoverage < minimumSemanticCoverage) return failure("INSUFFICIENT_SEMANTIC_OVERLAP", resultMetrics);
  return { supported: true, claimSupportVersion, supportStatus: "SUPPORTED", supportFailureCode: "", supportMetrics: resultMetrics };
}
