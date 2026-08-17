# 大模型价格雷达

用于对比主流大模型服务商及模型价格的静态网站。

## 每日价格来源检查

GitHub Actions 每日 UTC 01:00（北京时间 09:00）抓取目录中的官方价格来源，并比较内容指纹。模型 API 定价页和个人编程套餐官方页使用独立的状态映射检查。
检测到变化时，工作流只会创建或更新 `automation/daily-pricing-update` 拉取请求，附上 `site/data/pricing-sync-report.md` 供人工核对。套餐官网价格证据变化仅标记为候选变更，绝不会自动改写 `site/src/data/codingPlans.js`。

工作流不会自动修改模型价格、合并拉取请求或发布站点。

## 个人编程套餐核验边界

个人编程套餐只引用各产品的官方来源：[Cursor Pricing](https://cursor.com/pricing)、[Claude 套餐说明](https://support.claude.com/en/articles/11049762-choose-a-claude-plan)、[Claude Code 套餐说明](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)、[TRAE Pricing](https://www.trae.ai/pricing) 和 [腾讯 CodeBuddy 定价](https://copilot.tencent.com/pricing)。

`site/src/data/codingPlans.js` 中的 `verifiedAt` 是人工核验日期；月费、计费周期、包含用量、额度/超额规则、编程入口和官方链接均须在人工复核后通过 PR 更新。对于官网未公开展示的价格、计费周期或额度，页面统一显示“未公开”，不会根据营销文案、相邻档位或动态页面文本推算。

每日任务按相同 `sourceUrl` 只抓取一次，以可提取的官网价格证据发现候选变化。候选变化仅进入报告，必须人工审核后才能通过 PR 更新公开数据；日检不会直接改写套餐字段或 `site/src/data/codingPlans.js`。

腾讯 CodeBuddy 的套餐页当前不会向无人值守请求提供可提取的档位价格证据，因此被显式标为 `manual`：每日报告只提示人工核验，不发起自动抓取，也不会因其超时或空证据阻断默认模型 API 日检。其他自动来源访问失败时，检查会失败且不会写入状态或报告。

## 运行边界

每日检查依赖各服务商官方页面可被 GitHub Actions 正常访问。任一官方来源访问失败（例如 WAF 拦截、网络超时或临时不可用）时，工作流会失败，不会创建 PR，也不会改动站点数据；因此无法保证每次检查都能取得最新数据。请查看 Actions 日志并人工处理来源访问问题后重新运行。

本地执行检查：

```bash
npm run pricing:check --prefix site
```
