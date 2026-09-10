# PC Rental 官网

独立于主租赁系统的 Cloudflare Worker 官网。静态网页由 Worker Assets 提供，`/api/devices` 通过只读 D1 查询实时返回公开设备信息。

## 本地预览

```sh
npm run dev
```

## 发布

```sh
npm run deploy
```

发布命令只会部署名为 `rent-web` 的独立 Worker，不会部署父目录中的 `rent` Worker。它与主系统共享 `rent` D1 数据库，但网页 API 不提供写操作，也不会返回序列号、资产标签或设备 Agent 信息。
