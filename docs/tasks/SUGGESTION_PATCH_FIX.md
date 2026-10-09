# 简历建议路径校验修复（2026-10-09）

用户报告 SUGGESTION_INVALID_PATCH。本地只读检查三次 FAILED suggestionRuns，分别为受保护字段、非法路径、highlight 路径不合法；没有生成建议条目。故障位于生成阶段，不能通过放宽接受建议的权限修复。

## 修改

- 提示版本 v3：由当前锁定简历生成唯一可编辑路径清单，列出 op/path/before；entries 使用真实稳定 ID，highlight replacement 必须包含数字下标，追加仅允许 /-。
- 动态 schema 将 targetPath、patch.path 和 factEvidence.sourcePath 限制为真实清单；证据不允许引用追加路径。patch 明确 op/path/value、最多一项操作。
- FACT_REQUIRED 仍不含正文、patch 或事实证据，但定位已有 replace 字段；缺失整个经历模块时以已有 selfEvaluation 为补充提示位置，不生成虚构经历结构。
- 专门修正 resume_suggestions 的通用 Chat JSON 提示：不再要求所有字符串非空，允许空 before，要求 FACT_REQUIRED 的 after 为空。其他 AI 任务的提示保持原样。
- 只有生成结果的路径/格式错误允许重新生成一次。两次使用同一 owned report、ResumeVersion、JD 与完整原始约束，不回传不合规正文。第二次仍完整执行原路径、引用与事实证据校验；持续失败仍 FAILED，未校验内容不创建建议。
- 原接受建议的字段 allowlist、内容哈希/版本冲突与逐条确认流程未放宽。前端为该错误增加明确说明，原简历不会因失败路径被修改。

## 验证

- 专项集成通过：路径转义、稳定 ID、highlight 数字下标、append 不可作为证据；首次非法路径后一次纠正成功；持续非法路径只有两次请求且保持 FAILED；原攻击/隐私/版本冲突/接受拒绝回归通过。
- 真实 DeepSeek 请求：同一失败任务对应的 locked report、ResumeHistory、JD/parse hash 只读核实，HTTP 200 / finish_reason stop / 1846 completion tokens；首次返回 6 条建议通过生产 normalizeGeneratedResumeSuggestions，其中 1 条可执行、5 条 FACT_REQUIRED。未写入用户建议记录或接受建议，未修改简历。
- 真实诊断仅输出状态/token/数量；不输出密钥、简历正文或模型正文，JD/report 联系方式隐藏，临时脚本已删除。
- node --check backend/server.js、corepack pnpm test、corepack pnpm build、git diff --check 均通过。
- 回归过程中一次全量运行在面试测试后端启动等待阶段失败；随后重新运行整套测试 exit 0。新增的 Chat 提示断言起初误用于 OpenAI Responses mock，改为验证两种 Provider 共用的路径清单后专项和全量通过。

保留其他未提交改动，不提交或部署。本地后端加载新代码后由用户重新生成，原失败历史保留。修复完成等待 Claude 独立验收。
