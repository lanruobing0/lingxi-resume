# 首页工作台预览对齐（2026-10-11）

用户截图指出首页预览偏左。仅调整现有 CSS，不扩展产品功能。

- 原因：fade-up 外层没有确定宽度，受内部固定三列的 min-content 撑开；内层 920px 卡片靠左。外层设 width: min(920px, 100%)、min-width: 0，内层水平 auto margin。
- 中间编辑列改 minmax(0, 1fr)，760px 以下改纵向单列，导航两列，窗口版本文字独立一行。
- 桌面 1440x900 CUA 实测 hero、wrapper、stage 中心同为 704.6667（浏览器内部可用宽度），预览宽 920；手机 390x900 单列且 scrollWidth/clientWidth 均 375，无横向溢出。临时 viewport 已恢复。
- 浏览器截图存 artifacts/landing-alignment/desktop.png 和 mobile.png（不提交）。pnpm build、node --check backend/server.js、git diff --check 通过。

完成待 Claude 独立验收，不涉及 AI/知识库、用户数据或 Docker。

## 追加：倾斜底板和双滚动条

用户指出仍歪且右侧长灰条。真实 DOM 查明 landing 的 overflow-x:hidden 隐式令 overflow-y:auto，内容高度比自身大 14px，创建无意义的内层纵向滚动条。改 overflow-x:clip，保留文档正常滚动；彩色底板移除旋转与横向偏移，统一垂直叠放（含 hover）。

实际 reload 后于 2549x1403 验证 hero/stage 中心均 1267，内层 auto/scroll 溢出容器为零，document.scrollingElement 为 HTML。390x900 复验无内层滚动，scrollWidth/clientWidth 均 375。截图 desktop-fixed-scroll.png 已在动画结束后保存；viewport 已恢复。build、后端语法和 diff 检查通过。旧验证漏掉内层滚动问题，本次补齐；待独立验收。

用户明确要求保留之前视觉样式后，已恢复原三层彩色底板 rotate/translate 及 hover 值，仅保留居中和横向 clip 修复。桌面实测 hero/stage 中心均约 712.3333，旋转矩阵已恢复且 nestedScroll 为零；截图 original-layers-restored.png。构建/语法/diff 通过，viewport 已恢复，待独立验收。
