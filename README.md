# 电脑设备租赁管理系统

基于 Cloudflare Workers、Hono、TypeScript 和 Cloudflare D1 的设备租赁网站，面向管理员、员工和客户三类用户。系统覆盖设备管理、合同签署、Stripe/银行转账/余额支付、验机归还、押金处理、退款、发票及推荐佣金等流程。

> **许可说明：** 本仓库仅公开源码供个人查看、评估和学习，不属于开源软件。未经版权所有者事先书面许可，不得运行或部署、修改、制作衍生作品、再分发或用于任何商业活动。详见 [LICENSE](LICENSE)。

## 主要功能

- 客户：注册登录、浏览设备、创建订单、在线签署合同、选择支付与退款方式、提交银行转账凭证图床链接、查看订单和发票。
- 员工：创建合同、审批订单、取机/还机登记、设备检查、填写损坏信息和照片链接、跟踪租赁状态。
- 管理员：用户与设备管理、合同模板与运营变量、转账凭证审核、Stripe 设置、押金退款、租前取消退款、财务和佣金管理。
- 支付：Stripe 托管 Checkout、银行转账和账户余额，币种固定为 AUD。
- 合同：模板变量替换、签署快照、内容哈希、签约 IP/设备记录、合同版本和归档。
- 安全：PBKDF2 密码、服务端会话、登录及敏感接口限流、请求来源检查、CSP/安全响应头、SQL 参数绑定、动态字段白名单、HTML 清洗和 CSV 公式注入防护。

## 技术栈

- Cloudflare Workers
- Cloudflare D1（SQLite）
- Hono
- TypeScript
- Stripe Checkout + Webhook
- `sanitize-html`

## 本地开发

需要 Node.js 20+、npm 和一个 Cloudflare 账户。

```bash
npm install
npm run db:migrate:local
npm run dev
```

Wrangler 会显示本地访问地址。基础迁移包含演示用户和设备数据，仅供本地开发；不要把演示身份或默认密码用于正式环境。正式部署前应单独创建管理员并设置高强度密码。

## Cloudflare 配置

项目的 Worker 和 D1 配置位于 `wrangler.jsonc`。创建自己的 D1 数据库后，将配置中的 `database_id` 替换成实际 ID：

```bash
npm run db:create
```

生产环境必须配置用于加密 Stripe 敏感设置的主密钥：

```bash
openssl rand -base64 32
npx wrangler secret put SETTINGS_ENCRYPTION_KEY
```

`SETTINGS_ENCRYPTION_KEY` 是网站自己的加密主密钥，不是 Stripe 密钥。程序使用它通过 AES-GCM 加密管理员填写的 Stripe Secret Key 和 Webhook Signing Secret。请使用随机高强度值并安全备份；丢失后，数据库中已有的 Stripe 密钥将无法解密，需要在后台清除并重新填写。

不要把 `.dev.vars`、Stripe 密钥或 `SETTINGS_ENCRYPTION_KEY` 提交到 Git。

## Stripe 配置

1. 登录网站管理员后台。
2. 打开“系统设置”。
3. 启用 Stripe 并填写 Publishable Key、Secret Key 和 Webhook Signing Secret。
4. 在 Stripe Dashboard 创建 webhook endpoint：

```text
https://<你的域名>/webhooks/stripe
```

订阅以下事件：

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Webhook 推荐使用 Stripe 的 **Snapshot payload**。Snapshot payload 会包含事件发生时的完整对象，当前处理程序可以直接读取 Checkout Session。Thin payload 通常只提供精简对象或资源引用，需要额外调用 Stripe API 获取完整数据，不适合当前实现。

测试模式必须同时使用 `pk_test_`、`sk_test_` 和测试 endpoint 的 `whsec_`；正式模式应使用对应的正式密钥。浏览器支付成功跳转不会直接改变订单状态，只有签名验证通过且订单 ID、客户 ID、金额和 AUD 币种全部匹配的 webhook 才会确认付款。

## 支付与退款规则

- 合同签署时可选择 Stripe、银行转账或账户余额。
- Stripe 收款金额为租金加押金，金额只从 D1 订单读取。
- 银行转账客户提交 Reference、说明和公开 HTTPS 图床链接，管理员审核通过后才确认付款。
- 客户签约时选择“退回余额”或“原路退回”，默认退回余额。
- 银行转账选择原路退款时，必须提供账户名、BSB 和银行账号；管理员在线下转账后再确认本地退款记录。
- 租赁结束后处理押金：可全退、部分扣除或全部扣除，只允许完成一次。发生扣款时必须填写金额与原因。
- 已付款且尚未开始的订单可“取消并全额退款”。租赁开始后不能使用该流程，只能在归还后处理押金。
- 没有 Stripe PaymentIntent 的历史 Square/card 交易无法自动通过 Stripe 退款。

## 图片凭证

项目不直接保存图片文件。转账凭证和损坏照片使用图床链接：

- 必须为公开可访问的 HTTPS URL。
- 禁止用户名密码 URL、localhost、回环地址和私有网段地址。
- 转账凭证限 1 个链接；损坏照片可填写多个链接。
- 不要上传身份证、住址、紧急联系人等不必要的敏感资料。

图床应自行配置访问控制、保留期限和删除策略。公开链接中不要包含长期有效的敏感访问令牌。

## 合同模板与变量

管理员可在“合同管理”编辑模板。模板支持 `${variable_name}` 形式的变量，包括：

- 订单与付款：设备 ID、发票号、币种、租金/押金付款、欠款、付款日期、Reference、配送方式和费用。
- 设备：品牌、CPU、内存、存储、显卡、系统、电池、充电器序列号、资产编号及各部件检查结果。
- 签约：客户/公司签名、签约 IP、设备、浏览器、操作系统和合同版本。
- 归还与损坏：归还状态/日期、检查人员、损坏说明与照片、维修或更换费用、押金扣款。
- 逾期与法律：逾期天数/费用、追回状态、司法辖区、保险、免责和隐私政策版本。
- 后台信息：创建/审批员工、创建/更新时间、合同状态和内部备注。

身份证件、住址、出生日期、驾照有效期和紧急联系人变量已移除，避免收集不必要的敏感信息。运营数据可以在合同详情页后续填写；签署完成时会保存不可随模板修改而变化的合同快照。

## 数据库迁移

本地迁移：

```bash
npm run db:migrate:local
```

远程迁移：

```bash
npm run db:migrate:remote
```

部署新代码前应先备份 D1，并查看待执行迁移。不要直接重复运行 `migrations/0001_schema.sql`，其中包含用于全新数据库初始化的删表语句；日常升级应使用 Wrangler migrations。

## 测试与构建

```bash
npm test
npx tsc --noEmit
npm audit
npm run deploy -- --dry-run
```

当前自动测试覆盖密码哈希、订单状态机、合同变量、图床 URL 校验和 HTML/XSS 清洗。

生成或同步 Cloudflare 类型：

```bash
npm run cf-typegen
```

## 部署

首次部署建议按以下顺序：

```bash
npm install
npm audit
npm run db:migrate:remote
npx wrangler secret put SETTINGS_ENCRYPTION_KEY
npm run deploy
```

部署完成后检查：

1. `/login` 可以正常打开，演示管理员密码已更换。
2. 管理后台 Stripe 状态与测试/正式模式正确。
3. Stripe webhook 地址返回的不是 404；直接在浏览器 GET 访问不能代表 webhook 是否正常，因为正式入口是 `POST /webhooks/stripe`。
4. Stripe Dashboard 的测试事件能被签名验证并记录。
5. 银行转账、余额支付、合同签署、发票、归还检查和退款流程正常。
6. Cloudflare Worker 日志中没有完整密钥、签名、密码或令牌。

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地 Worker |
| `npm test` | 运行自动测试 |
| `npm run deploy` | 部署 Worker |
| `npm run db:create` | 创建 D1 数据库 |
| `npm run db:migrate:local` | 应用本地迁移 |
| `npm run db:migrate:remote` | 应用远程迁移 |
| `npm run db:execute` | 在远程 D1 执行命令 |
| `npm run cf-typegen` | 生成 Cloudflare 类型 |

## 安全运维建议

- 定期轮换 Stripe Secret、Webhook Secret 和 `SETTINGS_ENCRYPTION_KEY`；轮换主密钥前先规划旧密文的重新配置。
- 为 Cloudflare 账户启用 MFA，并限制可部署项目的 API Token 权限。
- 启用 Cloudflare WAF、Bot 防护和告警，持续观察 401、403、429、支付失败及 webhook 验签失败。
- 定期执行 `npm audit`、备份 D1，并演练订单、合同、付款和退款数据恢复。
- 退款、转账审核、设备损坏扣款等操作应使用独立员工账号，避免共享管理员账户。

## 项目结构

```text
src/index.ts          Worker 路由与中间件
src/site.ts           数据访问、合同变量和通用业务逻辑
src/stripe.ts         Stripe 配置加密与 API 封装
src/actions/          表单、支付及业务操作
src/pages/            管理员、员工、客户和公共页面
migrations/           D1 数据库迁移
tests/                自动测试
wrangler.jsonc        Cloudflare Worker/D1 配置
```

## License

本项目采用自定义的 **Source-Available, No Modification, No Commercial Use License**。源码公开仅用于个人查看、评估和学习，不代表授予开源软件通常包含的使用、修改或再分发权利。

未经版权所有者事先书面许可，不得：

- 运行、托管、部署本软件或以其提供服务；
- 修改、翻译或制作任何衍生作品；
- 复制或再分发源码（许可证允许保留的一份个人参考副本除外）；
- 用于商业活动、企业内部业务、收费服务或其他营利场景。

访问版权所有者公开运营的网站不受上述软件部署限制。完整条款及免责声明请参阅 [LICENSE](LICENSE)。
