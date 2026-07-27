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

## 数据库

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
