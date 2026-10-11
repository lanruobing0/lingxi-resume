# 首页工作台预览对齐（2026-10-11）

用户截图指出首页预览偏左。仅调整现有 CSS，不扩展产品功能。

- 原因：fade-up 外层没有确定宽度，受内部固定三列的 min-content 撑开；内层 920px 卡片靠左。外层设 width: min(920px, 100%)、min-width: 0，内层水平 auto margin。
- 中间编辑列改 minmax(0, 1fr)，760px 以下改纵向单列，导航两列，窗口版本文字独立一行。
- 桌面 1440x900 CUA 实测 hero、wrapper、stage 中心同为 704.6667（浏览器内部可用宽度），预览宽 920；手机 390x900 单列且 scrollWidth/clientWidth 均 375，无横向溢出。临时 viewport 已恢复。
- 浏览器截图存 artifacts/landing-alignment/desktop.png 和 mobile.png（不提交）。pnpm build、node --check backend/server.js、git diff --check 通过。

完成待 Claude 独立验收，不涉及 AI/知识库、用户数据或 Docker。
