# 每日价格更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每天检查官方价格页变化，生成有校验和报告的审核 PR，而不自动把不可信价格发布到生产。

**Architecture:** Node 同步脚本以官方 URL 为输入，取得页面内容后计算内容指纹和模型级候选变更。当前目录作为已发布真相源；同步脚本只在能解析并通过目录校验时更新候选目录和报告。GitHub Actions 每天运行脚本，在存在变更时更新一个自动化分支并创建 PR。

**Tech Stack:** Node.js 20、原生 `fetch`、Node test runner、GitHub Actions、GitHub CLI。

## Global Constraints

- 只使用各模型现有官方 `sourceUrl`。
- 解析或校验失败时退出非零，不修改 `site/src/data/catalog.js`。
- 自动化仅创建 PR；不能自动合并或发布。
- 价格、日期、来源域名继续受现有 `catalogValidation` 规则约束。

---

### Task 1: 建立价格同步核心与离线测试

**Files:**
- Create: `site/scripts/pricing-sync-core.mjs`
- Create: `site/tests/pricing-sync.test.mjs`
- Create: `site/tests/fixtures/openai-pricing.md`
- Modify: `site/package.json`

**Interfaces:**
- Produces: `fetchOfficialSource(sourceUrl, fetchImpl)`, `fingerprint(content)`, `buildSyncReport(entries, fetchedAt)`。
- Produces: `assertSourceResult({ providerId, sourceUrl, content })`，失败时抛出带 providerId 的错误。

- [ ] **Step 1: 写入失败测试**

```js
import { strict as assert } from "node:assert";
import { fingerprint, assertSourceResult } from "../scripts/pricing-sync-core.mjs";

assert.notEqual(fingerprint("价格 2.00"), fingerprint("价格 3.00"));
assert.throws(() => assertSourceResult({ providerId: "openai", sourceUrl: "https://example.com", content: "x" }));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/pricing-sync.test.mjs`

- [ ] **Step 3: 实现最小核心**

```js
export const fingerprint = (content) => createHash("sha256").update(content).digest("hex");
export function assertSourceResult({ providerId, sourceUrl, content }) {
  if (!providerId || !/^https:\/\//.test(sourceUrl) || !content.trim()) throw new Error(`invalid source: ${providerId}`);
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test tests/pricing-sync.test.mjs`

- [ ] **Step 5: 提交**

```bash
git add site/scripts/pricing-sync-core.mjs site/tests/pricing-sync.test.mjs site/tests/fixtures/openai-pricing.md site/package.json
git commit -m "feat: add pricing sync core"
```

### Task 2: 实现只读每日检查与报告

**Files:**
- Create: `site/scripts/check-pricing.mjs`
- Create: `site/data/pricing-source-state.json`
- Modify: `site/package.json`
- Test: `site/tests/pricing-sync.test.mjs`

**Interfaces:**
- Consumes: `fetchOfficialSource`, `fingerprint`, `buildSyncReport`。
- Produces: `site/data/pricing-source-state.json` 和 `site/data/pricing-sync-report.md`。

- [ ] **Step 1: 写入失败测试**

```js
const result = await checkPricing({ fetchImpl: fakeFetch, now: "2026-08-07" });
assert.equal(result.changed, true);
assert.match(result.report, /OpenAI/);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/pricing-sync.test.mjs`

- [ ] **Step 3: 实现最小检查器**

```js
const result = await Promise.all(sourceUrls.map((entry) => fetchOfficialSource(entry.sourceUrl, fetchImpl)));
const changed = result.some((entry) => prior[entry.sourceUrl] !== entry.fingerprint);
await writeFile(statePath, JSON.stringify(nextState, null, 2));
await writeFile(reportPath, buildSyncReport(result, now));
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test tests/pricing-sync.test.mjs`

- [ ] **Step 5: 提交**

```bash
git add site/scripts/check-pricing.mjs site/data/pricing-source-state.json site/data/pricing-sync-report.md site/package.json site/tests/pricing-sync.test.mjs
git commit -m "feat: add daily pricing source check"
```

### Task 3: 配置每日 GitHub PR 工作流

**Files:**
- Create: `.github/workflows/daily-pricing-update.yml`
- Modify: `README.md`
- Test: `.github/workflows/daily-pricing-update.yml`

**Interfaces:**
- Consumes: `npm run pricing:check`，退出码 0 时使用 `peter-evans/create-pull-request@v7`。
- Produces: 每日或手动触发的 `automation/daily-pricing-update` PR。

- [ ] **Step 1: 写入工作流结构测试**

```js
assert.match(workflow, /schedule:/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /npm run pricing:check/);
assert.match(workflow, /create-pull-request/);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/pricing-sync.test.mjs`

- [ ] **Step 3: 实现工作流**

```yaml
on:
  schedule:
    - cron: "0 1 * * *"
  workflow_dispatch:
jobs:
  update:
    permissions: { contents: write, pull-requests: write }
```

- [ ] **Step 4: 运行验证**

Run: `node --test tests/pricing-sync.test.mjs && npm test -- --run && npm run build`

- [ ] **Step 5: 提交**

```bash
git add .github/workflows/daily-pricing-update.yml README.md site/tests/pricing-sync.test.mjs
git commit -m "ci: add daily pricing update workflow"
```

### Task 4: 创建仓库并发布

**Files:**
- Modify: Git remote configuration only.

**Interfaces:**
- Consumes: 干净工作树和已通过验证的 `codex/model-price-site`。
- Produces: GitHub 仓库、`origin` 远程和已推送分支。

- [ ] **Step 1: 创建私有 GitHub 仓库**

Run: `gh repo create llm-price-radar --private --source . --remote origin --push`

- [ ] **Step 2: 验证远程和 Actions 配置**

Run: `git remote -v && gh repo view --json nameWithOwner,url,defaultBranchRef`

- [ ] **Step 3: 提交并推送最终实现**

Run: `git push -u origin codex/model-price-site`
