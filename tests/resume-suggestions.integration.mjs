import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (value) => createHash("sha256").update(String(value)).digest("hex");
const sessionHash = (value) => createHash("sha256").update(String(value)).digest("base64url");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}

function snapshot({ id = 1, selfEvaluation = "具备 React 组件开发经验。" } = {}) {
  const value = {
    id, userId: 1, resumeVersion: 1, title: "前端工程师", targetPosition: "前端开发", targetPositionId: 1,
    basicInfo: { realName: "PRIVATE-NAME", currentPosition: "前端工程师", email: "private@example.com", phone: "13800138000", city: "杭州", website: "https://private.example", profileFields: [] },
    selfEvaluation,
    sections: [{ key: "skills", label: "专业技能", entries: [{ id: "skill-1", name: "", role: "", startDate: "", endDate: "", isCurrent: false, highlights: ["React、TypeScript"] }] }, { key: "work", label: "工作经历", entries: [] }, { key: "projects", label: "项目经历", entries: [] }],
  };
  return { ...value, contentHash: sha(JSON.stringify(value)) };
}

function mockFactEvidence(before, after) {
  const source = String(before || "");
  const target = String(after || "");
  for (const match of target.matchAll(/[A-Za-z][A-Za-z0-9.+#/-]*|\d+(?:\.\d+)?%?/g)) {
    if (source.includes(match[0])) return [{ fact: match[0], sourcePath: "/selfEvaluation", sourceQuote: source }];
  }
  for (let length = Math.min(12, target.length); length >= 3; length -= 1) {
    for (let start = 0; start + length <= target.length; start += 1) {
      const fact = target.slice(start, start + length);
      if (/^[\p{L}\p{N}+#.%]+$/u.test(fact) && source.includes(fact)) return [{ fact, sourcePath: "/selfEvaluation", sourceQuote: source }];
    }
  }
  return [];
}

async function main() {
  const state = { mode: "valid", entityCase: null, providerBodies: [], backendOutput: [] };
  const provider = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    state.providerBodies.push(raw);
    const suggestions = state.mode === "invalidPatch" ? [{ sectionType: "自我评价", targetPath: "/userId", suggestionType: "REWRITE", rationale: "非法路径", before: "", after: "x", patch: [{ op: "replace", path: "/userId", value: "x" }], factEvidence: [], sourceClaimIds: ["claim-1"], recommendationRefs: ["建议突出已有 React 经历"] }] : state.entityCase ? [
      { sectionType: "自我评价", targetPath: "/selfEvaluation", suggestionType: "REWRITE", rationale: "固定事实差异回归", before: state.entityCase.before, after: state.entityCase.after, patch: [{ op: "replace", path: "/selfEvaluation", value: state.entityCase.after }], factEvidence: state.entityCase.factEvidence ?? (state.entityCase.blocked ? [] : mockFactEvidence(state.entityCase.before, state.entityCase.after)), sourceClaimIds: ["claim-1"], recommendationRefs: ["建议突出已有 React 经历"] },
    ] : [
      { sectionType: "自我评价", targetPath: "/selfEvaluation", suggestionType: "REWRITE", rationale: "报告建议突出已有 React 经历", before: "具备 React 组件开发经验。", after: "具备 React 组件开发经验，表达更聚焦前端岗位。", patch: [{ op: "replace", path: "/selfEvaluation", value: "具备 React 组件开发经验，表达更聚焦前端岗位。" }], factEvidence: mockFactEvidence("具备 React 组件开发经验。", "具备 React 组件开发经验，表达更聚焦前端岗位。"), sourceClaimIds: ["claim-1"], recommendationRefs: ["建议突出已有 React 经历"] },
      { sectionType: "自我评价", targetPath: "/selfEvaluation", suggestionType: "REWRITE", rationale: "需要事实支撑", before: "具备 React 组件开发经验。", after: "将页面性能提升 50%。", patch: [{ op: "replace", path: "/selfEvaluation", value: "将页面性能提升 50%。" }], factEvidence: [], sourceClaimIds: ["claim-1"], recommendationRefs: ["建议突出已有 React 经历"] },
      { sectionType: "专业技能", targetPath: "/selfEvaluation", suggestionType: "KEYWORD_ALIGNMENT", rationale: "需要技能事实支撑", before: "具备 React 组件开发经验。", after: "具备 Kubernetes 运维经验。", patch: [{ op: "replace", path: "/selfEvaluation", value: "具备 Kubernetes 运维经验。" }], factEvidence: [], sourceClaimIds: ["claim-1"], recommendationRefs: ["建议突出已有 React 经历"] },
      { sectionType: "项目经历", targetPath: "/selfEvaluation", suggestionType: "FACT_REQUIRED", rationale: "请补充可验证的性能指标。", before: "具备 React 组件开发经验。", after: "", patch: [], factEvidence: [], sourceClaimIds: ["claim-1"], recommendationRefs: ["建议突出已有 React 经历"] },
    ];
    const body = JSON.stringify({ output_text: JSON.stringify({ suggestions }) });
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(body);
  });
  const providerPort = await listen(provider);
  const probe = createServer(); const apiPort = await listen(probe); probe.close();
  const dir = await mkdtemp(path.join(tmpdir(), "lingxi-resume-suggestions-"));
  const token = "suggestion-token"; const otherToken = "other-token"; const lockedSnapshot = snapshot();
  const factualDeltaCases = [
    { name: "C to C++", before: "具备 C 开发基础。", after: "具备 C++ 核心模块开发经验。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "C to C#", before: "具备 C 开发基础。", after: "具备 C# 客户端开发经验。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "JavaScript to Java", before: "具备 JavaScript 前端经验。", after: "具备 Java 后端开发经验。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "Java to JavaScript", before: "具备 Java 后端经验。", after: "具备 JavaScript 前端开发经验。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "React to React Native", before: "具备 React 开发经验。", after: "具备 React Native 开发经验。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "Spring to Spring Cloud", before: "具备 Spring 开发经验。", after: "具备 Spring Cloud 微服务经验。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "evidence missing client fact", before: "负责后端开发。", after: "客户是星河云。", blocked: false, evidenceBlocked: true },
    { name: "evidence missing contact party fact", before: "负责后端开发。", after: "对接方是北辰云。", blocked: false, evidenceBlocked: true },
    { name: "evidence missing partner fact", before: "负责后端开发。", after: "合作对象是云舟。", blocked: false, evidenceBlocked: true },
    { name: "evidence missing subject-first client fact", before: "负责后端开发。", after: "星河云是客户。", blocked: false, evidenceBlocked: true },
    { name: "evidence missing cooperation fact", before: "负责后端开发。", after: "与星河云合作。", blocked: false, evidenceBlocked: true },
    { name: "evidence missing service object fact", before: "负责后端开发。", after: "服务对象为星河云。", blocked: false, evidenceBlocked: true },
    { name: "coverage high concurrency", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 构建高并发缓存系统。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage high availability", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 构建高可用缓存系统。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage microservices", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 构建微服务缓存系统。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage high performance", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 构建高性能缓存系统。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage high reliability", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 构建高可靠缓存系统。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage reliability", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 构建可靠缓存系统。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage scalability", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 构建可扩展缓存系统。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage parallel processing", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 实现并行处理能力。", blocked: false, evidenceBlocked: true, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "coverage partial evidence", before: "使用 Redis 构建缓存模块。", after: "使用 Redis 和 Kafka 构建高可用缓存系统，性能提升 50%。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT", factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块。" }] },
    { name: "valid high concurrency and availability evidence", before: "使用 Redis 构建高并发、高可用缓存模块。", after: "基于 Redis 构建高并发、高可用缓存模块。", blocked: false, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建高并发、高可用缓存模块。" }, { fact: "高并发", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建高并发、高可用缓存模块。" }, { fact: "高可用", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建高并发、高可用缓存模块。" }] },
    { name: "valid microservices evidence", before: "使用 Redis 构建微服务缓存模块。", after: "基于 Redis 构建微服务缓存模块。", blocked: false, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建微服务缓存模块。" }, { fact: "微服务", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建微服务缓存模块。" }] },
    { name: "valid high performance evidence", before: "使用 Redis 构建高性能缓存模块。", after: "基于 Redis 构建高性能缓存模块。", blocked: false, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建高性能缓存模块。" }, { fact: "高性能", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建高性能缓存模块。" }] },
    { name: "valid high reliability evidence", before: "使用 Redis 构建高可靠缓存模块。", after: "基于 Redis 构建高可靠缓存模块。", blocked: false, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建高可靠缓存模块。" }, { fact: "高可靠", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建高可靠缓存模块。" }] },
    { name: "valid supported performance wording", before: "持续提升系统性能。", after: "进一步提升系统性能。", blocked: false },
    { name: "valid supported stability wording", before: "持续优化接口稳定性。", after: "进一步优化接口稳定性。", blocked: false },
    { name: "valid supported documentation wording", before: "持续完善项目文档。", after: "进一步完善项目文档。", blocked: false },
    { name: "valid supported user experience wording", before: "持续改进用户体验。", after: "进一步改进用户体验。", blocked: false },
    { name: "valid Redis and metric evidence", before: "使用 Redis 构建缓存模块，接口响应时间降低 30%。", after: "基于 Redis 构建缓存模块，将接口响应时间降低 30%。", blocked: false, factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块，接口响应时间降低 30%。" }, { fact: "30%", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块，接口响应时间降低 30%。" }], tamperAfter: "使用 Redis 构建高并发、高可用微服务缓存系统。", tamperFactEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis 构建缓存模块，接口响应时间降低 30%。" }], tamperFailureCode: "SUGGESTION_EVIDENCE_MISSING" },
    { name: "invalid evidence fabricated quote", before: "负责后端开发。", after: "负责后端开发。", blocked: false, evidenceBlocked: true, evidenceFailureCode: "SUGGESTION_EVIDENCE_INVALID", factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "使用 Redis" }] },
    { name: "invalid evidence fact quote mismatch", before: "使用 Java 开发后端接口。", after: "使用 Java 开发后端接口。", blocked: false, evidenceBlocked: true, evidenceFailureCode: "SUGGESTION_EVIDENCE_INVALID", factEvidence: [{ fact: "Redis", sourcePath: "/selfEvaluation", sourceQuote: "Java" }] },
    { name: "invalid evidence metadata path", before: "负责后端开发。", after: "负责后端开发。", blocked: false, evidenceBlocked: true, evidenceFailureCode: "SUGGESTION_EVIDENCE_INVALID", factEvidence: [{ fact: "后端", sourcePath: "/userId", sourceQuote: "后端" }] },
    { name: "invalid evidence missing quote", before: "负责后端开发。", after: "负责后端开发。", blocked: false, evidenceBlocked: true, evidenceFailureCode: "SUGGESTION_EVIDENCE_INVALID", factEvidence: [{ fact: "后端", sourcePath: "/selfEvaluation", sourceQuote: "不存在的引用" }] },
    { name: "invalid evidence cross-section quote", before: "具备 React 组件开发经验。", after: "具备 React 组件开发经验。", blocked: false, evidenceBlocked: true, evidenceFailureCode: "SUGGESTION_EVIDENCE_INVALID", factEvidence: [{ fact: "React", sourcePath: "/sections/skills/entries/skill-1/highlights/0", sourceQuote: "具备 React" }] },
    { name: "invalid evidence JD quote", before: "负责后端开发。", after: "负责后端开发。", blocked: false, evidenceBlocked: true, evidenceFailureCode: "SUGGESTION_EVIDENCE_INVALID", factEvidence: [{ fact: "React", sourcePath: "/selfEvaluation", sourceQuote: "需要 React" }] },
    { name: "invalid evidence old-version quote", before: "负责后端开发。", after: "负责后端开发。", blocked: false, evidenceBlocked: true, evidenceFailureCode: "SUGGESTION_EVIDENCE_INVALID", factEvidence: [{ fact: "后端", sourcePath: "/selfEvaluation", sourceQuote: "旧版本后端经历" }] },
    { name: "new Alibaba", before: "参与前端项目开发。", after: "参与阿里巴巴项目开发。", blocked: true },
    { name: "new ByteDance", before: "参与前端项目开发。", after: "参与 ByteDance 项目开发。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "existing C++", before: "使用 C++ 开发核心模块。", after: "熟练使用 C++ 完成核心模块开发。", blocked: false },
    { name: "existing JavaScript", before: "使用 JavaScript 编写前端逻辑。", after: "使用 JavaScript 优化前端逻辑。", blocked: false },
    { name: "existing Alibaba", before: "具备阿里巴巴项目经验。", after: "持续梳理阿里巴巴项目经验。", blocked: false },
    { name: "existing 50%", before: "将系统性能提升 50%。", after: "曾将系统性能提升 50%，并持续优化。", blocked: false },
    { name: "ordinary Chinese wording", before: "负责前端开发工作。", after: "负责前端开发，表达更简洁清晰。", blocked: false },
    { name: "new Xiaomi project", before: "参与前端项目开发。", after: "参与小米项目开发。", blocked: true },
    { name: "new JD project", before: "参与前端项目开发。", after: "负责京东项目核心模块开发。", blocked: true },
    { name: "new NetEase employer", before: "负责后端开发。", after: "在网易负责后端开发。", blocked: true },
    { name: "new Bilibili client", before: "负责移动端开发。", after: "为B站开发移动端功能。", blocked: true },
    { name: "new synthetic StarCloud", before: "参与前端项目开发。", after: "参与星河云项目开发。", blocked: true },
    { name: "new synthetic Beichen", before: "负责后端开发。", after: "加入北辰科技负责后端开发。", blocked: true },
    { name: "new synthetic BlueWhale", before: "参与项目开发。", after: "参与蓝鲸计划开发。", blocked: true },
    { name: "new synthetic CloudBoat", before: "负责平台开发。", after: "负责云舟平台开发。", blocked: true },
    { name: "existing Xiaomi", before: "参与小米项目开发。", after: "负责小米项目核心模块开发。", blocked: false },
    { name: "existing StarCloud", before: "参与星河云项目开发。", after: "主导星河云项目性能优化。", blocked: false },
    { name: "existing NetEase", before: "在网易负责后端开发。", after: "在网易负责核心后端服务开发。", blocked: false },
    { name: "ordinary performance wording", before: "负责后端接口开发。", after: "负责后端核心接口开发与性能优化。", blocked: false },
    { name: "ordinary system design", before: "负责后端开发。", after: "负责后端系统设计与接口优化。", blocked: false },
    { name: "ordinary team collaboration", before: "负责后端接口开发。", after: "负责后端接口开发并推进团队协作。", blocked: false },
    { name: "relation participated", before: "负责后端开发。", after: "曾参与星河云相关工作。", blocked: true },
    { name: "relation involved", before: "负责后端开发。", after: "工作内容涉及星河云。", blocked: true },
    { name: "relation docked", before: "负责后端开发。", after: "对接星河云团队完成接口。", blocked: true },
    { name: "relation assisted", before: "负责后端开发。", after: "协助星河云完成系统建设。", blocked: true },
    { name: "relation assumed", before: "负责后端开发。", after: "承担星河云相关模块开发。", blocked: true },
    { name: "relation coordinated", before: "负责后端开发。", after: "配合星河云团队完成接口联调。", blocked: true },
    { name: "relation provided", before: "负责后端开发。", after: "为星河云提供后端支持。", blocked: true },
    { name: "relation customer", before: "负责后端开发。", after: "面向星河云客户提供技术能力。", blocked: true },
    { name: "relation side", before: "负责后端开发。", after: "负责星河云侧后端开发。", blocked: true },
    { name: "relation subject first", before: "负责后端开发。", after: "星河云相关项目由我负责。", blocked: true },
    { name: "relation subject first team", before: "负责后端开发。", after: "与星河云团队进行接口对接。", blocked: true },
    { name: "relation employment context", before: "负责后端开发。", after: "在星河云相关业务中负责后端开发。", blocked: true },
    { name: "relation synthetic NovaFlow", before: "负责后端开发。", after: "对接NovaFlow团队完成接口。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "relation synthetic AuroraX", before: "负责后端开发。", after: "协助AuroraX完成系统建设。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "relation synthetic BeichenCloud", before: "负责后端开发。", after: "承担北辰云相关模块开发。", blocked: true },
    { name: "role leading functional tokens", before: "负责后端开发。", after: "主要和星河云团队协作。", blocked: true },
    { name: "role leading functional tokens mixed", before: "负责后端开发。", after: "主要与 NovaFlow 团队协作。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "role copular business party", before: "负责后端开发。", after: "星河云是我负责对接的业务方。", blocked: true },
    { name: "role copular customer", before: "负责后端开发。", after: "AuroraX 是团队服务的客户。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "role side with leading action", before: "负责后端开发。", after: "完成星河云侧接口适配。", blocked: true },
    { name: "role side synthetic", before: "负责后端开发。", after: "完成北辰云侧系统改造。", blocked: true },
    { name: "role customer synthetic", before: "负责后端开发。", after: "为 NovaFlow 客户提供后端支持。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "role copular platform", before: "负责后端开发。", after: "AuroraX 作为我负责维护的平台。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "role unknown team", before: "负责后端开发。", after: "和青岚科技团队长期协作。", blocked: true },
    { name: "role concise copular", before: "负责后端开发。", after: "云舟是主要合作方。", blocked: true },
    { name: "role bridge as business party", before: "负责后端开发。", after: "北辰云作为业务方参与联调。", blocked: true },
    { name: "role customer side mixed", before: "负责后端开发。", after: "完成 AuroraX 客户侧接口开发。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "role customer service", before: "负责后端开发。", after: "主要服务 NovaFlow 客户。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "copular object customer", before: "负责后端开发。", after: "负责对接的客户是星河云。", blocked: true },
    { name: "copular object comma boundary", before: "负责后端开发。", after: "我的主要客户是星河云，负责提供接口服务。", blocked: true },
    { name: "copular object core customer", before: "负责后端开发。", after: "我的核心客户是星河云。", blocked: true },
    { name: "copular object platform", before: "负责后端开发。", after: "主要参与的平台是云舟。", blocked: true },
    { name: "copular object customer NovaFlow", before: "负责后端开发。", after: "主要客户是 NovaFlow。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "copular object partner AuroraX", before: "负责后端开发。", after: "合作方为 AuroraX。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "copular object business party", before: "负责后端开发。", after: "服务的业务方是北辰云。", blocked: true },
    { name: "copular object long-term business party", before: "负责后端开发。", after: "长期服务的业务方是北辰云。", blocked: true },
    { name: "copular object project", before: "负责后端开发。", after: "参与的项目是蓝鲸计划。", blocked: true },
    { name: "copular object maintained platform", before: "负责后端开发。", after: "负责维护的平台是 CloudRiver。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "copular object connected team", before: "负责后端开发。", after: "对接团队是星海科技。", blocked: true },
    { name: "copular object service object", before: "负责后端开发。", after: "我的服务对象为青岚科技。", blocked: true },
    { name: "copular object core partner", before: "负责后端开发。", after: "核心合作方为 BlueRiver。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "copular object substring StarCloud", before: "参与星河项目开发。", after: "负责对接的客户是星河云。", blocked: true },
    { name: "copular object substring NovaFlow", before: "参与 Nova 项目开发。", after: "主要参与的平台是 NovaFlow。", blocked: true, failureCode: "SUGGESTION_UNSUPPORTED_FACT" },
    { name: "existing StarCloud docking", before: "曾参与星河云项目开发。", after: "对接星河云团队完成接口优化。", blocked: false },
    { name: "existing StarCloud assumed", before: "曾参与星河云项目开发。", after: "承担星河云核心模块开发。", blocked: false },
    { name: "existing StarCloud business", before: "曾参与星河云项目开发。", after: "在星河云相关业务中负责后端服务。", blocked: false },
    { name: "existing StarCloud assisted", before: "曾参与星河云项目开发。", after: "协助星河云完成系统性能优化。", blocked: false },
    { name: "existing StarCloud leading functional tokens", before: "参与星河云项目开发。", after: "主要和星河云团队协作。", blocked: false },
    { name: "existing StarCloud side", before: "参与星河云项目开发。", after: "完成星河云侧接口适配。", blocked: false },
    { name: "existing StarCloud copular", before: "参与星河云项目开发。", after: "星河云是我负责对接的业务方。", blocked: false },
    { name: "existing StarCloud platform", before: "参与星河云项目开发。", after: "完善星河云平台稳定性。", blocked: false },
    { name: "existing StarCloud copular object", before: "负责星河云客户的接口开发。", after: "负责对接的客户是星河云。", blocked: false },
    { name: "existing StarCloud copular object comma boundary", before: "负责星河云客户的接口开发。", after: "我的主要客户是星河云，负责提供接口服务。", blocked: false },
    { name: "existing NovaFlow copular object", before: "参与 NovaFlow 平台开发。", after: "主要参与的平台是 NovaFlow。", blocked: false },
    { name: "existing Beichen long-term copular object", before: "长期服务北辰云业务。", after: "长期服务的业务方是北辰云。", blocked: false },
    { name: "ordinary involved wording", before: "负责后端开发。", after: "涉及系统性能优化。", blocked: false, evidenceBlocked: true },
    { name: "ordinary front-back docking", before: "负责后端开发。", after: "对接前后端接口。", blocked: false, evidenceBlocked: true },
    { name: "ordinary team assist", before: "负责后端开发。", after: "协助团队完成系统设计。", blocked: false, evidenceBlocked: true },
    { name: "ordinary core module", before: "负责后端开发。", after: "承担核心模块开发。", blocked: false, evidenceBlocked: true },
    { name: "ordinary business needs", before: "负责后端开发。", after: "负责相关业务需求。", blocked: false, evidenceBlocked: true },
    { name: "ordinary team coordination", before: "负责后端开发。", after: "配合团队完成接口联调。", blocked: false, evidenceBlocked: true },
    { name: "ordinary technical support", before: "负责后端开发。", after: "提供后端技术支持。", blocked: false, evidenceBlocked: true },
    { name: "ordinary improve system stability", before: "负责后端开发。", after: "完善系统稳定性。", blocked: false, evidenceBlocked: true },
    { name: "ordinary complete interface adaptation", before: "负责后端开发。", after: "完成接口适配。", blocked: false, evidenceBlocked: true },
    { name: "ordinary team collaboration", before: "负责后端开发。", after: "主要和团队协作。", blocked: false, evidenceBlocked: true },
    { name: "ordinary team integration", before: "负责后端开发。", after: "与团队完成接口联调。", blocked: false, evidenceBlocked: true },
    { name: "ordinary optimize platform stability", before: "负责后端开发。", after: "优化平台稳定性。", blocked: false, evidenceBlocked: true },
    { name: "ordinary improve system performance", before: "负责后端开发。", after: "提升系统性能。", blocked: false, evidenceBlocked: true },
    { name: "ordinary improve project documents", before: "负责后端开发。", after: "完善项目文档。", blocked: false, evidenceBlocked: true },
    { name: "ordinary core development", before: "负责后端开发。", after: "负责核心模块开发。", blocked: false, evidenceBlocked: true },
    { name: "ordinary long-term team collaboration", before: "负责后端开发。", after: "和团队长期协作。", blocked: false, evidenceBlocked: true },
    { name: "ordinary developer role", before: "负责后端开发。", after: "作为开发人员参与联调。", blocked: false, evidenceBlocked: true },
    { name: "ordinary customer-side interface", before: "负责后端开发。", after: "完成客户侧接口适配。", blocked: false, evidenceBlocked: true },
    { name: "ordinary platform maintenance", before: "负责后端开发。", after: "主要负责平台维护。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular stable system", before: "负责后端开发。", after: "系统是稳定的。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular performance goal", before: "负责后端开发。", after: "目标是提升性能。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular interface focus", before: "负责后端开发。", after: "重点是接口优化。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular work content", before: "负责后端开发。", after: "工作内容是系统设计。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular maintainability", before: "负责后端开发。", after: "核心是提高可维护性。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular response delay", before: "负责后端开发。", after: "主要问题是响应延迟。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular current task", before: "负责后端开发。", after: "当前任务是完善项目文档。", blocked: false, evidenceBlocked: true },
    { name: "ordinary copular responsibility", before: "负责后端开发。", after: "我的职责是后端开发。", blocked: false },
  ];
  const jdRaw = "需要 React 和 TypeScript 开发经验。"; const jdHash = sha(jdRaw);
  const baseStore = {
    users: [{ id: 1, username: "owner", passwordHash: "x", role: "USER", status: 1 }, { id: 2, username: "other", passwordHash: "x", role: "USER", status: 1 }],
    sessions: [{ id: 1, userId: 1, tokenHash: sessionHash(token), expiresAt: new Date(Date.now() + 60000).toISOString() }, { id: 2, userId: 2, tokenHash: sessionHash(otherToken), expiresAt: new Date(Date.now() + 60000).toISOString() }],
    resumes: [{ ...lockedSnapshot, version: 1 }], resumeHistories: [{ id: 1, resumeId: 1, resumeVersion: 1, version: 1, contentHash: lockedSnapshot.contentHash, snapshot: lockedSnapshot }],
    jobDescriptions: [{ id: 1, userId: 1, title: "前端", rawText: jdRaw, rawTextHash: jdHash, currentParseResultId: 1, parseStatus: "SUCCEEDED" }],
    jobDescriptionParseResults: [{ id: 1, userId: 1, jobDescriptionId: 1, status: "SUCCEEDED", rawTextHash: jdHash, parsedData: { requiredSkills: [{ text: "React", evidence: "React" }] } }],
    jobApplications: [{ id: 1, userId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: lockedSnapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1 }],
    resumeJobMatches: [{ id: 1, userId: 1, jobApplicationId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: lockedSnapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, status: "COMPLETED", report: { dimensions: [] } }],
    matchReports: [{ id: 1, userId: 1, jobApplicationId: 1, resumeJobMatchId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: lockedSnapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, jobDescriptionRawTextHash: jdHash, status: "COMPLETED", reportVersion: 1, content: { dimensionReports: [], gaps: ["缺少量化结果"], recommendations: ["建议突出已有 React 经历"], claims: [{ claimId: "claim-1", claimType: "BASE_MATCH_FACT", text: "简历已有 React 经验", baseEvidence: ["React"] }] } }],
    suggestionRuns: [], resumeSuggestions: [], aiSettingsByUser: { "1": { aiConfig: { provider: "OpenAI" }, aiProviderConfigs: { OpenAI: { baseUrl: `http://127.0.0.1:${providerPort}/v1`, modelId: "mock-suggestions", apiKey: "provider-SECRET", enabled: true } } } },
  };
  factualDeltaCases.forEach((item, index) => {
    const id = index + 2;
    const caseSnapshot = snapshot({ id, selfEvaluation: item.before });
    baseStore.resumes.push({ ...caseSnapshot, version: 1 });
    baseStore.resumeHistories.push({ id, resumeId: id, resumeVersion: 1, version: 1, contentHash: caseSnapshot.contentHash, snapshot: caseSnapshot });
    baseStore.jobApplications.push({ id, userId: 1, resumeId: id, resumeVersionId: id, resumeVersion: 1, resumeContentHash: caseSnapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1 });
    baseStore.resumeJobMatches.push({ id, userId: 1, jobApplicationId: id, resumeId: id, resumeVersionId: id, resumeVersion: 1, resumeContentHash: caseSnapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, status: "COMPLETED", report: { dimensions: [] } });
    baseStore.matchReports.push({ id, userId: 1, jobApplicationId: id, resumeJobMatchId: id, resumeId: id, resumeVersionId: id, resumeVersion: 1, resumeContentHash: caseSnapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, jobDescriptionRawTextHash: jdHash, status: "COMPLETED", reportVersion: 1, content: { dimensionReports: [], gaps: [], recommendations: ["建议突出已有 React 经历"], claims: [{ claimId: "claim-1", claimType: "BASE_MATCH_FACT", text: "简历已有相关经验", baseEvidence: [] }] } });
  });
  await writeFile(path.join(dir, "store.json"), JSON.stringify(baseStore));
  let backend;
  const start = () => { backend = spawn(process.execPath, ["backend/server.js"], { cwd: root, env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dir, OPENAI_API_KEY: "", OPENAI_BASE_URL: "", OPENAI_MODEL: "" }, stdio: ["ignore", "pipe", "pipe"] }); backend.stdout.on("data", (part) => state.backendOutput.push(String(part))); backend.stderr.on("data", (part) => state.backendOutput.push(String(part))); };
  const stop = async () => { if (backend?.pid && backend.exitCode === null) backend.kill("SIGKILL"); await wait(50); };
  const healthy = async () => { for (let i = 0; i < 100; i += 1) { try { if ((await fetch(`http://127.0.0.1:${apiPort}/api/health`)).ok) return; } catch {} await wait(25); } throw new Error(`backend unavailable: ${state.backendOutput.join("")}`); };
  const call = async (tokenValue, pathname, body, expected) => { const response = await fetch(`http://127.0.0.1:${apiPort}${pathname}`, { method: body === undefined ? "GET" : "POST", headers: { Cookie: `lingxi_session=${tokenValue}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); const data = await response.json(); if (expected !== undefined) assert.equal(response.status, expected, JSON.stringify(data)); return data; };
  try {
    start(); await healthy();
    const created = await call(token, "/api/match-reports/1/resume-suggestions", {}, 201);
    assert.equal(created.item.status, "COMPLETED"); assert.equal(created.item.baseResumeVersion, 1); assert.equal(created.item.baseResumeContentHash, lockedSnapshot.contentHash); assert.equal(created.item.suggestions.length, 4);
    const [rewrite, fabricated, fabricatedTechnology, factRequired] = created.item.suggestions;
    assert.equal(rewrite.status, "PENDING"); assert.equal(fabricated.suggestionType, "FACT_REQUIRED"); assert.equal(fabricated.patch.length, 0); assert.equal(fabricated.failureCode, "SUGGESTION_UNSUPPORTED_FACT"); assert.equal(factRequired.suggestionType, "FACT_REQUIRED");
    assert.equal(fabricatedTechnology.suggestionType, "FACT_REQUIRED"); assert.equal(fabricatedTechnology.failureCode, "SUGGESTION_UNSUPPORTED_FACT");
    assert.equal((await call(otherToken, "/api/match-reports/1/resume-suggestions", undefined, 404)).failureCode, "SUGGESTION_REPORT_NOT_FOUND");
    assert.equal((await call(otherToken, `/api/resume-suggestions/${rewrite.id}/accept`, { expectedBaseResumeVersion: 1 }, 404)).failureCode, "SUGGESTION_NOT_FOUND");
    assert.equal((await call(token, `/api/resume-suggestions/${factRequired.id}/accept`, { expectedBaseResumeVersion: 1 }, 409)).failureCode, "SUGGESTION_FACT_REQUIRED");
    assert.equal((await call(token, `/api/resume-suggestions/${factRequired.id}/reject`, {}, 200)).item.status, "REJECTED");
    assert.equal((await call(token, `/api/resume-suggestions/${factRequired.id}/reject`, {}, 409)).failureCode, "SUGGESTION_ALREADY_DECIDED");
    const accepted = await call(token, `/api/resume-suggestions/${rewrite.id}/accept`, { expectedBaseResumeVersion: 1 }, 201);
    assert.equal(accepted.item.status, "ACCEPTED"); assert.equal(accepted.resumeVersion.version, 2); assert.equal((await call(token, `/api/resume-suggestions/${rewrite.id}/accept`, { expectedBaseResumeVersion: 1 }, 409)).failureCode, "SUGGESTION_ALREADY_DECIDED");
    const afterAccept = await call(token, `/api/suggestion-runs/${created.item.id}`, undefined, 200);
    assert.equal(afterAccept.item.suggestions.find((item) => item.id === fabricated.id).status, "INVALIDATED"); assert.equal(afterAccept.item.suggestions.find((item) => item.id === factRequired.id).status, "REJECTED");
    assert.equal(afterAccept.item.suggestions.find((item) => item.id === fabricatedTechnology.id).status, "INVALIDATED");
    const saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    assert.equal(saved.resumeHistories.filter((item) => item.resumeId === 1).length, 2); assert.equal(saved.resumeHistories.find((item) => item.resumeId === 1 && item.resumeVersion === 1).snapshot.selfEvaluation, "具备 React 组件开发经验。", "base snapshot must remain unchanged"); assert.equal(saved.resumes[0].selfEvaluation, "具备 React 组件开发经验，表达更聚焦前端岗位。");
    assert.equal(state.providerBodies.some((body) => /PRIVATE-NAME|private@example.com|13800138000|provider-SECRET|Cookie|Authorization/i.test(body)), false, "provider prompt leaked private data");
    const tamperedSuggestions = [];
    for (let index = 0; index < factualDeltaCases.length; index += 1) {
      const testCase = factualDeltaCases[index];
      const reportId = index + 2;
      state.entityCase = testCase;
      const generated = await call(token, `/api/match-reports/${reportId}/resume-suggestions`, {});
      assert.equal(generated.item?.status, "COMPLETED", `${testCase.name}: ${JSON.stringify(generated)}`);
      state.entityCase = null;
      const suggestion = generated.item.suggestions[0];
      if (testCase.blocked || testCase.evidenceBlocked) {
        assert.equal(suggestion.suggestionType, "FACT_REQUIRED", `${testCase.name} must require a user fact`);
        assert.equal(suggestion.failureCode, testCase.failureCode || testCase.evidenceFailureCode || "SUGGESTION_EVIDENCE_MISSING", `${testCase.name} must retain the stable failure code`);
        assert.deepEqual(suggestion.patch, [], `${testCase.name} must not retain a patch`);
        assert.equal(suggestion.after, "", `${testCase.name} must not retain fabricated text`);
        assert.equal((await call(token, `/api/resume-suggestions/${suggestion.id}/accept`, { expectedBaseResumeVersion: 1 }, 409)).failureCode, "SUGGESTION_FACT_REQUIRED", `${testCase.name} must not be accepted`);
        assert.equal((await call(token, `/api/resumes/${reportId}/versions`, undefined, 200)).items.length, 1, `${testCase.name} must not create a new version`);
      } else {
        assert.equal(suggestion.suggestionType, "REWRITE", `${testCase.name} must remain a rewrite`);
        assert.equal(suggestion.failureCode, null, `${testCase.name} must not have a factual failure`);
        assert.deepEqual(suggestion.patch, [{ op: "replace", path: "/selfEvaluation", value: testCase.after }], `${testCase.name} must preserve its validated patch`);
        assert.equal(suggestion.after, testCase.after, `${testCase.name} must preserve its rewritten text`);
        assert.ok(Array.isArray(suggestion.factEvidence) && suggestion.factEvidence.length, `${testCase.name} must retain validated base-resume evidence`);
        if (testCase.tamperAfter) {
          tamperedSuggestions.push({ id: suggestion.id, resumeId: reportId, after: testCase.tamperAfter, factEvidence: testCase.tamperFactEvidence, failureCode: testCase.tamperFailureCode || "SUGGESTION_EVIDENCE_INVALID" });
        } else {
          assert.equal((await call(token, `/api/resume-suggestions/${suggestion.id}/accept`, { expectedBaseResumeVersion: 1 }, 201)).item.status, "ACCEPTED", `${testCase.name} must be accepted`);
        }
      }
    }
    assert.equal(tamperedSuggestions.length, 1, "a valid suggestion must be available for the evidence revalidation attack");
    for (const tamperedCase of tamperedSuggestions) {
      const tamperedStore = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
      const tamperedSuggestion = tamperedStore.resumeSuggestions.find((item) => item.id === tamperedCase.id);
      tamperedSuggestion.after = tamperedCase.after;
      tamperedSuggestion.patch = [{ op: "replace", path: "/selfEvaluation", value: tamperedSuggestion.after }];
      tamperedSuggestion.factEvidence = tamperedCase.factEvidence;
      await writeFile(path.join(dir, "store.json"), JSON.stringify(tamperedStore));
      await stop(); start(); await healthy();
      assert.equal((await call(token, `/api/resume-suggestions/${tamperedCase.id}/accept`, { expectedBaseResumeVersion: 1 }, 409)).failureCode, tamperedCase.failureCode, "accept must revalidate tampered evidence");
      assert.equal((await call(token, `/api/resumes/${tamperedCase.resumeId}/versions`, undefined, 200)).items.length, 1, "tampered acceptance must not create a new version");
      const persistedAfterBlockedAccept = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
      assert.equal(persistedAfterBlockedAccept.resumeSuggestions.find((item) => item.id === tamperedCase.id).status, "PENDING", "blocked tampered acceptance must not decide the suggestion");
      assert.equal(persistedAfterBlockedAccept.resumes.find((item) => item.id === tamperedCase.resumeId).version, 1, "blocked tampered acceptance must preserve the original resume version");
    }
    const staleRun = await call(token, "/api/match-reports/1/resume-suggestions", {}, 201);
    assert.equal((await call(token, `/api/resume-suggestions/${staleRun.item.suggestions[0].id}/accept`, { expectedBaseResumeVersion: 1 }, 409)).failureCode, "RESUME_VERSION_CONFLICT");
    state.mode = "invalidPatch";
    const invalid = await call(token, "/api/match-reports/1/resume-suggestions", {}, 422);
    assert.equal(invalid.failureCode, "SUGGESTION_INVALID_PATCH");
    const persisted = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8")); assert.equal(persisted.suggestionRuns.at(-1).status, "FAILED", "provider/validation failure must persist");
    assert.equal(JSON.stringify({ suggestionRuns: persisted.suggestionRuns, resumeSuggestions: persisted.resumeSuggestions }).includes("provider-SECRET"), false); assert.equal(state.backendOutput.join("").match(/provider-SECRET|Cookie|Authorization|PRIVATE-NAME/) !== null, false);
    console.log("Resume suggestions integration passed: immutable bindings, factual-delta protection, patch allowlist, accept/reject semantics, conflicts, isolation, persistence, and privacy.");
  } finally { await stop(); await new Promise((resolve) => provider.close(resolve)); await rm(dir, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
