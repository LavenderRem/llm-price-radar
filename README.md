# 大模型价格雷达

用于对比主流大模型服务商及模型价格的静态网站。

## 每日价格来源检查

GitHub Actions 每日 UTC 01:00（北京时间 09:00）抓取目录中的官方价格来源，并比较内容指纹。
检测到变化时，工作流只会创建或更新 `automation/daily-pricing-update` 拉取请求，附上 `site/data/pricing-sync-report.md` 供人工核对。

工作流不会自动修改模型价格、合并拉取请求或发布站点。

本地执行检查：

```bash
npm run pricing:check --prefix site
```
