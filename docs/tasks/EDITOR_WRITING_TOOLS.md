# 编辑器内检查与段落润色（2026-10-09）

用户批准：不新增独立“简历检查”栏目，移除侧栏 AI 工具，把检查简历、润色这段融入编辑器。

- 侧栏移除 AI 工具；删除未再使用的 AiToolsPanel / GrammarPanel / OptimizePanel。旧 ai-tools、grammar、optimize 地址进入简历库；应用内旧润色入口进入已有明确简历的编辑器，无简历时进入简历库。
- 编辑器显示检查与润色面板；检查收集目标岗位、简介和可见模块正文，排除基本信息与自定义个人资料字段。简介、经历要点、普通模块提供段落润色入口；简介/经历要点可选中文本，未选中时使用该段全文。
- 原 owned resume grammar-check/optimize API 复用；调用前保存当前简历，保存失败阻止调用；结果写入既有记录，页面显示提交原文、问题/建议与复制功能，不自动覆盖简历正文。
- 编辑器尚未加载真实简历时禁用 AI 操作。生成中禁用重复操作，错误明确展示且清除旧结果。
- 正文可能包含联系方式，前端移除已知姓名、联系方式、城市和 profile 值及 email/URL/手机号；服务端新增 filterWritingContext，检查与润色的 provider-safe context 和输入正文均过滤嵌入式隐私信息，原 userId/resumeId/version/hash 记录不变，不修改其他 AI 阶段。
- 本次没有调用真实个人 AI、修改个人简历或删除个人记录；浏览器使用隔离 API fixture。

验证：node --check backend/server.js、corepack pnpm build、corepack pnpm test、node tests/writing-privacy.unit.mjs 全部 exit 0。Playwright/Edge `tests/editor-writing.browser.mjs` 验证入口删除、保存后调用、隐私过滤、正文不被自动改写、失败状态、旧链接及 1440/390 无溢出；截图 artifacts/editor-writing/。

完成后等待 Claude 独立验收，不推送或部署。按项目已保存的本地提交偏好保存当前任务提交，排除真实数据、密钥和生成截图。
