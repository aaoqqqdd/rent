# AGENTS.md

面向 AI 编码代理（Claude Code、Cursor、Copilot 等）的项目指引。人类贡献者请优先阅读 [README.md](README.md)。

## 项目概览

Cloudflare Workers 上的电脑设备租赁管理系统。单 Worker 应用，服务端渲染 HTML，无前端框架、无构建步骤（`wrangler` 直接打包 `src/index.ts`）。三类工作区：客户（`/customer/*`）、员工（`/staff/*`）、管理员（`/admin/*`）。

## 技术栈

- **运行时**：Cloudflare Workers
- **框架**：Hono（`hono/jsx` 仅在个别处使用，多数页面是模板字符串拼 HTML）
- **数据库**：Cloudflare D1（SQLite），binding 名为 `RENT`（`c.env.RENT`）
- **语言**：TypeScript，`moduleResolution: Bundler`，`strict: true`
- **支付**：Stripe Checkout + Webhook
- **邮件**：Resend（`RESEND_API_KEY`）
- **依赖**：`hono`、`nanoid`、`sanitize-html`

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地 Worker（`wrangler dev`），launch.json 中的 `rent-dev` 用 8787 端口 |
| `npm test` | 运行 `tests/*.test.ts`（node --test + ts-node） |
| `npx tsc --noEmit` | 类型检查 |
| `npm run db:migrate:local` | 应用本地 D1 migrations |
| `npm run db:migrate:remote` | 应用远程 D1 migrations |
| `npm run deploy` | 部署（`wrangler deploy --minify`） |
| `npm run cf-typegen` | 重新生成 `worker-configuration.d.ts` |

改完代码后至少跑 `npm test` 和 `npx tsc --noEmit`。

## 目录结构

```text
src/index.ts          Worker 入口：所有路由、中间件、认证、限流、Webhook
src/site.ts           数据访问层 + 业务逻辑 + 合同/站点变量渲染（最大的文件，~3700 行）
src/stripe.ts         Stripe 配置的 AES-GCM 加解密与 API 封装
src/emailConfig.ts    邮件配置摘要
src/rmbExchange.ts    AUD→CNY 汇率
src/layout.html       页面外壳（作为文本模块 import）
src/styles.css        全站样式（作为文本模块 import，路由 /styles.css 直接返回）
src/actions/          表单/支付/业务写操作，按角色分子目录，统一从 actions/index.ts re-export
src/pages/            页面渲染函数，按 public/customer/staff/admin 分目录，统一从 pages/index.ts re-export
migrations/           D1 migrations（100+ 个，按序号命名，禁止改历史文件）
tests/                node:test 测试；text-module-loader.mjs 让测试能 import .html/.css
设计文档/             中文需求/设计文档（付款、优惠码、推荐计划、收据等）
```

## 关键约定与注意事项

- **无构建步骤**：不要引入需要打包/编译的工具链。`.html` 和 `.css` 通过 `wrangler.jsonc` 的 `rules`（Text 模块）被 `import` 成字符串；测试侧由 `tests/text-module-loader.mjs` 提供同等能力。
- **配置文件**：`wrangler.jsonc` 是唯一配置文件。D1 binding 是 `RENT`，cron 为每日 `0 0 * * *`（清理过期合同、访客账户、未付款订单）。
- **`src/index.ts` 顶部有 `@ts-nocheck`**：该文件不参与严格类型检查，其余源码文件都应保持类型正确。新逻辑尽量放进 `src/site.ts` 或 `src/pages`/`src/actions` 并保证类型通过。
- **认证**：基于 session cookie，`findUserBySession` 查用户；角色为 `CUSTOMER` / `STAFF` / `ADMIN`，`getAccessLevel(user)` 返回细分权限（如 `MANAGER`、`ADMIN`）。路由里逐个手动校验 `user.role`，新增受保护路由要照做。
- **中间件顺序**（`src/index.ts` 内 `app.use('*', ...)`）：静态资源短路 → 通知 → 访客账户限制 → 请求体大小限制 + 限流（`enforceRateLimit`）→ 其它。新增高风险 POST 路由应加对应限流规则。
- **迁移**：`npm run deploy` 不会自动跑 migrations。新增 schema 变更 = 新建 `migrations/NNNN_描述.sql`，序号递增，**不要修改已存在的迁移文件**。`0001_schema.sql` 含建表前的 DROP，仅用于初始化。
- **密钥**：Stripe Secret / Webhook Secret 加密后存 D1，主密钥为 `SETTINGS_ENCRYPTION_KEY`。其它 secret：`GOOGLE_MAPS_API_KEY`、`RESEND_API_KEY`、`EMAIL_FROM`。不要把 `.dev.vars`、密钥、Token 提交到版本库。
- **不存图片文件**：转账凭证、损坏照片一律用外部 HTTPS 链接，经 `validateHostedImageUrls` 校验（拒绝 localhost / 内网 / 带账号密码的 URL）。
- **HTML 输出**：用户可控内容必须经 `sanitizeRichHtml` / `sanitizePlainText`；页面内联 `<script>` 会被测试用 `new Function` 解析校验语法，别写非法 JS。
- **金额**：Stripe 收款金额由服务端从 D1 订单重新计算（租金+押金，本金上加 2.5% 手续费），不信任前端传值。付款确认只认 Webhook 签名有效且订单/客户/金额/币种（AUD）全部匹配。
- **订单状态机**：转移必须走 `canTransitionOrder`；押金处理每笔只能一次。
- **文件头**：所有源码文件保留 PolyForm Noncommercial 1.0.0 版权注释块。

## 代码风格

- 跟随所在文件的既有风格：多数为紧凑单行、模板字符串拼 HTML、`async` D1 查询。
- 新增页面：在对应角色目录建 `renderXxx` 函数，并在 `src/pages/index.ts` 加 `export *`。
- 新增写操作：放 `src/actions/<role>/`，在 `src/actions/index.ts` 加 `export *`。
- 复用 `src/site.ts` 里已有的 helper（用户、订单、合同、设备、通知、审计日志等），不要另起一套数据访问。
- 界面文案用简体中文。

## 提交

- 提交信息可用中文，遵循 Conventional Commits（仓库历史里 `feat:` / `refactor:` 混用中英文均可）。
- 提交前确认 `npm test` 与 `npx tsc --noEmit` 通过。
- 涉及数据库的改动，附上新的 `migrations/NNNN_*.sql`。
