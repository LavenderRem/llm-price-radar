# 大模型价格雷达

用于对比主流大模型服务商及模型价格的静态网站。

## 每日价格来源检查

GitHub Actions 每日 UTC 01:00（北京时间 09:00）抓取目录中的官方价格来源，并比较内容指纹。
检测到变化时，工作流只会创建或更新 `automation/daily-pricing-update` 拉取请求，附上 `site/data/pricing-sync-report.md` 供人工核对。

工作流不会自动修改模型价格、合并拉取请求或发布站点。

## 运行边界

每日检查依赖各服务商官方页面可被 GitHub Actions 正常访问。任一官方来源访问失败（例如 WAF 拦截、网络超时或临时不可用）时，工作流会失败，不会创建 PR，也不会改动站点数据；因此无法保证每次检查都能取得最新数据。请查看 Actions 日志并人工处理来源访问问题后重新运行。

本地执行检查：

```bash
npm run pricing:check --prefix site
```
