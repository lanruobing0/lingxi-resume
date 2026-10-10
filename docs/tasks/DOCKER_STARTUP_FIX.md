# Docker 冷启动 socket 崩溃修复（2026-10-10）

用户报告每次本项目启动 Docker 弹出 unexpected error，明确授权持续修复。

## 诊断

- 首次检查 5173/8876/6333 均无监听。现有快捷方式启动器恢复前后端后，Docker Desktop 4.88.1 在启动 host Ingest 服务时崩溃：无法 remove `Docker/run/sailor-ingest.sock`。发生在 Qdrant compose 之前。
- `Docker/run` 有 4 个零字节 ReparsePoint；`docker-secrets-engine/engine.sock` 同样残留。Node lstat socket 返回 EACCES。上游对应记录：https://github.com/docker/desktop-feedback/issues/554。
- 崩溃实例 graceful stop 失败；确认 engine pipe 不存在、日志明确 backend crashed 后，退出崩溃的 Desktop/backend 进程。未执行 WSL shutdown/unregister、Docker reset、数据卷删除或重装。

## 修复

- `scripts/docker-runtime-guard.cjs`：冷启动前，只有 Docker Desktop/backend 全部停止才检查临时目录；允许指定名称（含 .stale）的零字节 ReparsePoint。未知内容、非零文件、子目录或顶层链接均拒绝处理。
- 检查前、检查后及每次改名之前均复核进程。仅原地改名 `Docker/run` 和 `docker-secrets-engine` 为带时间/PID 的备份，再建立空目录；不递归搬运、删除，不触碰 wsl、VHDX、镜像或卷。
- `scripts/lingxi-launcher.cjs` 保存实际启动实现到 Git，保留原前后端启动/配置、Qdrant compose 和日志逻辑。健康 Docker/Qdrant 直接复用；正在启动的 Desktop 等待现有实例，不重复启动或强制结束。
- 原 `C:/Users/Lucas/Documents/Codex/2026-09-28/bang/outputs/lingxi-launcher.cjs` 改为兼容入口，保留原 runtime/state 路径。桌面/项目快捷方式及 stop cmd 无需更换；同目录启动说明已更新。

## 实际验证

- `node tests/docker-runtime-guard.unit.cjs` 通过：运行状态跳过；空目录跳过；合法 socket；未知路径/文件、非零、非链接、子目录、顶层链接均阻断。
- guard、launcher 与 backend `node --check` 通过；`corepack pnpm build` 通过。
- 第一轮残留隔离 → Docker engine 29.7.2 正常 → Qdrant healthy → `/ready` 200。
- 热启动重复执行：前后端/Qdrant 全部复用，未改名 runtime。
- 确认仅 web-qdrant-1 在运行，其他项目容器均已停止后，使用 Docker 官方 CLI 正常退出（exit 0）；再通过修复启动器冷启动，第二轮残留隔离成功，engine/Qdrant 再次恢复。
- 再次热启动通过；最终 `/ready` 200、persistence/json 和 qdrant 均 ok；现有公共知识 collection green，23 points 可读，其他项目容器仍存在且状态为 stopped。
- 不调用 AI/Embedding，不修改个人业务记录。归档 socket 备份保留，不自动删除。

## 限制与交接

这是项目入口对 Docker Desktop/Windows 残留 socket 问题的持续规避，并非改写 Docker 上游。绕过入口直接启动 Docker 仍可能触发同一上游缺陷；未知临时目录内容会安全停止处理。保留备份以供审查。完成后等待独立验收，不推送或部署。
