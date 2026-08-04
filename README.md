# 基于 AI 的智能简历优化与模拟面试平台

这是一个面向求职者的 AI 简历优化与模拟面试产品，视觉参考 Magic Resume 的简历编辑工作台，并扩展了真实 AI 简历诊断、简历优化、模拟面试、历史记录和后台管理模块。

## 界面展示

### 简历编辑器

![灵犀简历编辑器](docs/images/resume-editor.png)

## 技术栈

- React
- Vite
- CSS
- lucide-react
- MySQL SQL 脚本

## 运行方式

```bash
pnpm install
pnpm dev
```

浏览器访问终端输出的本地地址。

## 后端接口

项目已内置一个轻量 Node.js API 服务，开发阶段使用本地 JSON 文件持久化数据，不需要额外安装依赖。

```bash
pnpm dev:api
```

默认地址：

```text
http://127.0.0.1:8787
```

## AI 配置

AI 诊断、润色、语法检查和面试反馈会调用真实 OpenAI 兼容接口。没有配置 API Key 时接口会返回明确错误，不会用本地规则冒充 AI 结果。

推荐使用环境变量：

```bash
OPENAI_API_KEY=你的_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.5
pnpm dev:api
```

也可以在页面的「AI 服务商」中保存 `Base URL`、`模型 ID` 和 `API Key`。后端不会把完整 API Key 返回给前端。

常用接口：

- `GET /api/health`：服务健康检查
- `GET /api/ai-config`：读取 AI 配置状态
- `PUT /api/ai-config`：保存 AI 服务商、Base URL、模型 ID 和 API Key
- `POST /api/auth/login`：用户登录。首次使用请通过注册页创建账号；项目不再提供默认弱密码账号。
- `POST /api/auth/register`：用户注册
- `GET /api/job-positions`：岗位方向列表
- `GET /api/resumes`：简历列表
- `GET /api/resumes/:id`：简历详情
- `POST /api/resumes/:id/analyze`：生成 AI 简历诊断记录
- `POST /api/resumes/:id/optimize`：生成 AI 润色记录
- `POST /api/resumes/:id/grammar-check`：生成 AI 语法检查记录
- `GET /api/resumes/:id/history`：简历版本历史
- `POST /api/interviews`：创建模拟面试
- `POST /api/interviews/:id/answers`：提交面试回答并生成反馈
- `GET /api/admin/overview`：后台统计概览

### 基础岗位匹配（阶段 3）

岗位匹配基于用户显式选择的 ResumeVersion 和已成功解析、仍有效的 JD。创建 JobApplication 时必须同时提交 `resumeId`、`resumeVersionId` 和 `jobDescriptionId`；不会以“当前简历”“最近版本”或“最新 JD”补全输入。

- `POST /api/job-applications/:id/matches`：为已锁定的申请创建一次新的基础匹配报告
- `GET /api/job-applications/:id/matches`：读取该申请的匹配历史摘要
- `GET /api/resume-job-matches/:matchId`：读取完整六维报告
- `POST /api/resume-job-matches/:matchId/retry`：只重试失败记录，且产生新的历史记录

报告的六个固定权重为：必备技能 30、项目相关性 25、关键词覆盖 15、经验 10、教育背景 10、表达质量 10。AI 只负责语义判断、双方证据与解释；后端验证证据后重新计算总分，绝不直接采用模型返回的总分。简历中没有证据时，界面和记录统一使用“当前简历中未找到相关证据”，不推断用户是否具备该能力。

匹配提示仅发送去隐私的 `buildAiResumeContext` 和锁定的 JD 材料；姓名、邮箱、电话、网站、照片、Session、API Key 和无关个人资料不会发送给第三方 AI。匹配不会修改简历，也不会覆盖历史报告。

## 数据库
开发运行时使用 `backend/data/store.json`；`database.sql` 是生产 MySQL 的结构与增量迁移参考，不会被 Node 服务在本地自动执行。文件末尾的“Incremental production migration reference”只包含非破坏性迁移建议，执行前应先备份并按目标 MySQL 版本检查列/索引是否已存在。

`database.sql` 包含课程设计所需的 MySQL 建库、建表和示例数据。

核心表包括：

- `user`
- `resume`
- `education_experience`
- `work_experience`
- `project_experience`
- `skill`
- `job_position`
- `resume_analysis_record`
- `resume_optimize_record`
- `interview_question`
- `mock_interview`
- `interview_answer`
- `system_notice`

## 页面模块

- 首页仪表盘
- 简历工作台
- AI 简历诊断
- AI 简历优化
- 模拟面试
- 历史记录
- 管理后台
