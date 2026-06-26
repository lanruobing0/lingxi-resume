# 基于 AI 的智能简历优化与模拟面试平台

这是一个用于 Web 应用课程设计的前端原型项目，视觉参考 Magic Resume 的简历编辑工作台，并扩展了 AI 简历诊断、简历优化、模拟面试、历史记录和后台管理模块。

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
