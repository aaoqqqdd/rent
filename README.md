```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## Stripe 配置

部署前先应用 D1 迁移，并设置用于加密管理员所填 Stripe 密钥的主密钥：

```txt
npm run db:migrate:remote
npx wrangler secret put SETTINGS_ENCRYPTION_KEY
```

然后在“管理员 → 系统设置”填写 Stripe Publishable Key、Secret Key 和 Webhook Signing Secret。Stripe webhook 地址为：

```txt
https://<你的域名>/webhooks/stripe
```

Webhook 需要订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed` 和 `checkout.session.expired`。

客户签署合同时可选择退款退回账户余额或原路退回，默认退回余额。银行转账选择原路退款时必须填写账户名、BSB 和银行账号；管理员需在线下完成转账后再确认退款操作。
