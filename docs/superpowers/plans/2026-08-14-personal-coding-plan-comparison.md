# 个人编程套餐对比实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有「模型价签」中交付个人编程套餐的官方口径对比页，并把套餐关键事实接入每日检查。

**Architecture:** 新建独立的套餐目录、格式化/筛选领域函数与页面组件，避免把套餐逻辑混入既有模型 API 单价数据。每日检查扩展为两个独立来源范围：现有服务商 API 定价页与新的套餐官方页；两者均只比较结构化关键事实的指纹，失败时不写入文件。

**Tech Stack:** React 19、Vite、Vitest、Node.js 原生测试、Decimal.js、GitHub Actions。

## Global Constraints

- 仅收录官方明确提供 IDE、CLI 或编程 Agent 使用权的个人套餐；纯通用聊天订阅不得入库。
- 每个免费、Pro、Max 等套餐档位独立一行；未公开信息显示「未公开」，不得推算。
- 原币种和原始金额是唯一数据源；CNY / USD 仅为展示换算。
- 每日检查只对月费、计费周期、包含用量、额度与超额、编程入口和官方链接变化创建更新。
- 任一来源失败时不得覆盖已有状态、目录或报告；不得自动合并或部署 PR。
- 不新增登录、支付、用户自定义套餐或自动购买功能。

---

## 文件结构

- `site/src/data/codingPlans.js`：官方核验后的个人编程套餐目录与来源元数据。
- `site/src/domain/codingPlans.js`：目录校验、币种换算、筛选、排序和三项对比纯函数。
- `site/src/components/CodingPlansView.jsx`：精确数据终端页面、筛选器、表格与右侧比较清单。
- `site/src/components/AppHeader.jsx`、`site/src/App.jsx`：新增「编程套餐」导航与页面路由状态。
- `site/src/styles.css`：仅追加套餐页所需布局，复用现有令牌。
- `site/scripts/check-pricing.mjs`：把套餐官方来源加入每日检查，并单独保存其价格指纹。
- `site/tests/codingPlans.test.js`、`site/tests/codingPlansView.test.jsx`：套餐领域逻辑与页面行为测试。
- `site/tests/pricing-sync.test.mjs`：套餐来源检查、关键字段变化和失败不落盘的 Node 测试。

## Task 1: 套餐目录与领域逻辑

**Files:**

- Create: `site/src/data/codingPlans.js`
- Create: `site/src/domain/codingPlans.js`
- Create: `site/tests/codingPlans.test.js`
- Modify: `site/src/data/catalog.js`
- Modify: `site/tests/catalogValidation.test.js`

**Interfaces:**

- Consumes: `exchangeRates` 中的 `{ base, quote, rate }` 记录和现有 `providers` 中的服务商标识。
- Produces: `codingPlans` 数组；`validateCodingPlans(plans, providers)`、`normalizeCodingPlan(plan, currency, exchangeRates)`、`filterAndSortCodingPlans(plans, state)`、`toggleCodingPlanComparison(ids, planId)` 和 `sanitizeCodingPlanComparisonIds(ids, plans)`。

- [ ] **Step 1: 写出目录和筛选的失败测试**

```js
import { codingPlans } from "../src/data/codingPlans.js";
import {
  filterAndSortCodingPlans,
  normalizeCodingPlan,
  validateCodingPlans,
} from "../src/domain/codingPlans.js";

test("catalog excludes a pure chat subscription and keeps each plan tier separate", () => {
  expect(codingPlans.some((plan) => plan.productName === "ChatGPT")).toBe(false);
  expect(codingPlans.filter((plan) => plan.productName === "Cursor").map((plan) => plan.planName))
    .toEqual(expect.arrayContaining(["Free", "Pro"]));
});

test("normalization keeps unpublished allowance explicit and converts only display prices", () => {
  const plan = { id: "cursor-pro", price: { amount: 20, currency: "USD", period: "month" }, allowancePolicy: { status: "unpublished" } };
  expect(normalizeCodingPlan(plan, "CNY", [{ base: "USD", quote: "CNY", rate: 7 }])).toMatchObject({
    displayPrice: 140,
    allowanceLabel: "未公开",
  });
});
```

- [ ] **Step 2: 运行测试，确认在模块不存在时失败**

Run: `npm test --prefix site -- codingPlans.test.js`

Expected: FAIL，提示无法解析 `codingPlans.js` 或 `codingPlans` 导出不存在。

- [ ] **Step 3: 写入最小目录和纯函数实现**

```js
export function normalizeCodingPlan(plan, currency, exchangeRates) {
  const displayPrice = currency === plan.price.currency
    ? plan.price.amount
    : convertCurrency(plan.price.amount, plan.price.currency, currency, exchangeRates);
  return {
    ...plan,
    displayPrice,
    allowanceLabel: plan.allowancePolicy.status === "unpublished"
      ? "未公开"
      : plan.allowancePolicy.label,
  };
}

export function filterAndSortCodingPlans(plans, { surfaces = [], freeOnly = false, sortBy = "price" } = {}) {
  return plans
    .filter((plan) => !surfaces.length || surfaces.some((surface) => plan.codingSurfaces.includes(surface)))
    .filter((plan) => !freeOnly || plan.price.amount === 0)
    .toSorted((left, right) => left.price.amount - right.price.amount || left.productName.localeCompare(right.productName));
}
```

目录记录必须包含 `id`、`providerId`、`productName`、`planName`、`planType`、`price`、`includedUsage`、`allowancePolicy`、`codingSurfaces`、`officialUrl`、`verifiedAt`、`officialSummary` 和 `sourceUrl`。在目录校验中拒绝未知 `providerId`、HTTP 来源、缺失编程入口和将 `planType: "general-chat"` 标为可展示的记录。

- [ ] **Step 4: 运行领域与目录测试，确认通过**

Run: `npm test --prefix site -- codingPlans.test.js catalogValidation.test.js`

Expected: PASS，且目录中每个档位都有 HTTPS 官方来源和明确的套餐类型。

- [ ] **Step 5: 提交本任务**

```bash
git add site/src/data/codingPlans.js site/src/domain/codingPlans.js site/tests/codingPlans.test.js site/src/data/catalog.js site/tests/catalogValidation.test.js
git commit -m "feat(套餐): 增加个人编程套餐目录"
```

## Task 2: 精确数据终端页面与套餐比较

**Files:**

- Create: `site/src/components/CodingPlansView.jsx`
- Create: `site/tests/codingPlansView.test.jsx`
- Modify: `site/src/components/AppHeader.jsx`
- Modify: `site/src/App.jsx`
- Modify: `site/src/styles.css`
- Modify: `site/tests/appNavigation.test.jsx`

**Interfaces:**

- Consumes: Task 1 的 `codingPlans`、`normalizeCodingPlan`、`filterAndSortCodingPlans`、`toggleCodingPlanComparison`；现有 `exchangeRates` 和币种状态。
- Produces: `CodingPlansView({ plans, currency, exchangeRates })`；「编程套餐」导航状态；独立于模型对比的 `selectedPlanIds`，上限 3。

- [ ] **Step 1: 写出页面交互的失败测试**

```jsx
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { App } from "../src/App.jsx";

test("opens coding plans and filters to IDE plans", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "编程套餐" }));
  await user.click(screen.getByRole("button", { name: "IDE" }));
  expect(screen.getByRole("heading", { name: "个人编程套餐" })).toBeInTheDocument();
  expect(screen.getAllByText("IDE").length).toBeGreaterThan(0);
  expect(screen.queryByText("CLI / 编程 Agent 专属示例")).not.toBeInTheDocument();
});

test("keeps the selected display currency after opening coding plans", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "USD" }));
  await user.click(screen.getByRole("button", { name: "编程套餐" }));
  expect(screen.getByRole("button", { name: "USD" })).toHaveAttribute("aria-pressed", "true");
});

test("keeps no more than three selected plans in the plan comparison tray", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "编程套餐" }));
  for (const label of ["选择 Cursor Free", "选择 Cursor Pro", "选择 Codex"]) await user.click(screen.getByRole("checkbox", { name: label }));
  expect(screen.getByText("对比清单 · 3/3")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行页面测试，确认在页面缺失时失败**

Run: `npm test --prefix site -- codingPlansView.test.jsx appNavigation.test.jsx`

Expected: FAIL，找不到「编程套餐」导航或「个人编程套餐」标题。

- [ ] **Step 3: 实现页面、导航和必要样式**

在 `AppHeader.jsx` 的 `views` 中添加 `{ id: "coding-plans", label: "编程套餐" }`。`App.jsx` 为该视图渲染 `CodingPlansView`，其套餐选择状态必须独立于现有 `compareIds`，防止模型对比链接和套餐对比互相污染。

`CodingPlansView` 使用语义化 `table` 渲染以下列：产品 / 套餐、月费、计费周期、包含用量、额度与超额、编程入口、官方来源。使用按钮实现「全部」「IDE」「CLI / Agent」「免费套餐」筛选；使用 `aria-pressed` 标示状态。每行复用现有复选交互的可访问性模式，并在右侧渲染三个已选套餐的月费、用量、规则和入口。未公开字段直接显示 `未公开`；官方来源使用外链并包含可访问名称。

新增样式仅使用 `tokens.css` 中的 `--primary`、`--line`、`--radius-*`、`--font-*` 和间距令牌；小屏时让表格横向滚动、右侧清单移动到表格下方。

- [ ] **Step 4: 运行前端测试与生产构建，确认通过**

Run: `npm test --prefix site -- codingPlansView.test.jsx appNavigation.test.jsx visualTokens.test.js && npm run build --prefix site`

Expected: PASS，构建产物包含编程套餐视图且不产生新的样式令牌违规。

- [ ] **Step 5: 提交本任务**

```bash
git add site/src/components/CodingPlansView.jsx site/src/components/AppHeader.jsx site/src/App.jsx site/src/styles.css site/tests/codingPlansView.test.jsx site/tests/appNavigation.test.jsx
git commit -m "feat(套餐): 增加精确数据对比页面"
```

## Task 3: 补齐多服务商官方套餐目录

**Files:**

- Modify: `site/src/data/catalog.js`
- Modify: `site/src/data/codingPlans.js`
- Modify: `site/src/domain/codingPlans.js`
- Modify: `site/tests/codingPlans.test.js`
- Modify: `site/tests/catalogValidation.test.js`

**Interfaces:**

- Consumes: 官方套餐页已核验的价格、额度和入口事实；现有 `providers` 与 `codingPlans`。
- Produces: Cursor、Claude Code、TRAE、CodeBuddy 的多档位个人编程套餐记录；`provider.officialDomains` 允许一个官方服务商使用多个受信任官方域名。

- [ ] **Step 1: 写出目录覆盖和官方多域名的失败测试**

```js
test("catalog includes verified personal coding plans from multiple providers", () => {
  expect(new Set(codingPlans.map((plan) => plan.providerId))).toEqual(expect.arrayContaining([
    "cursor", "anthropic", "trae", "codebuddy",
  ]));
  expect(codingPlans.some((plan) => plan.productName === "Gemini Code Assist")).toBe(false);
});

test("coding plan source may use only a declared official provider domain", () => {
  const plan = { ...codingPlans[0], providerId: "anthropic", officialUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan", sourceUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan" };
  expect(() => validateCodingPlans([plan], providers)).not.toThrow();
  expect(() => validateCodingPlans([{ ...plan, sourceUrl: "https://example.com/pricing" }], providers)).toThrow(/sourceUrl/);
});
```

- [ ] **Step 2: 运行测试，确认现有单一 Cursor 目录失败**

Run: `npm test --prefix site -- codingPlans.test.js catalogValidation.test.js`

Expected: FAIL，提示缺少 Anthropic、TRAE 或 CodeBuddy 的套餐记录，或尚不支持 `officialDomains` 中的官方来源。

- [ ] **Step 3: 录入官方可核验套餐并最小扩展来源校验**

在 provider 上新增可选 `officialDomains`，以 HTTPS hostname 列表验证套餐来源；未声明时仍只允许 `officialPricingUrl` hostname。该字段仅用于套餐目录校验，不得改变既有模型 API 定价页的日检来源。

录入以下截至 `2026-08-14` 的官方可核验事实：

- Claude Code：Claude Pro（USD 20/月或 USD 200/年）、Max 5x（USD 100/月）、Max 20x（USD 200/月）；官方说明其用量包适用于 Claude Code。额度表达为官方容量倍率或可购买的用量包，不换算为请求数。
- TRAE IDE：Lite（USD 3/月，USD 5 基础用量加赠送用量）、Pro（USD 10/月）；Pro+ 与 Ultra 仅在官方页面明确存在但未公开逐档价格时保留为 `unpublished`，不推算。入口为 IDE / Agent。
- 腾讯 CodeBuddy 国内个人版：体验版（CNY 0/月，500 积分）、标准版（CNY 99/月，基础 2000 + 赠送 2000 积分）、高级版（CNY 199/月，基础 4000 + 赠送 5000 积分）、旗舰版（CNY 999/月，基础 20000 + 赠送 30000 积分）；付费档可有 1000 积分 / CNY 50 的 1 个月加量包。
- Cursor 保留已有 Free、Pro、Pro+、Ultra，未公开价格继续为 `unpublished`。

不要录入 Gemini Code Assist for individuals：官方已说明消费者个人访问已弃用。不要在没有可访问的 OpenAI 官方文档明确个人 Codex 套餐价格与权益时录入 OpenAI 条目；这不是以通用聊天订阅替代编程套餐。

- [ ] **Step 4: 运行目录测试，确认通过**

Run: `npm test --prefix site -- codingPlans.test.js catalogValidation.test.js`

Expected: PASS；所有展示记录均为个人编程套餐、每档位独立、来源属于声明的官方域名；已下线个人方案不展示。

- [ ] **Step 5: 提交本任务**

```bash
git add site/src/data/catalog.js site/src/data/codingPlans.js site/src/domain/codingPlans.js site/tests/codingPlans.test.js site/tests/catalogValidation.test.js
git commit -m "feat(套餐): 补齐多服务商官方套餐"
```

## Task 4: 将套餐关键事实接入每日检查

**Files:**

- Modify: `site/scripts/check-pricing.mjs`
- Modify: `site/scripts/pricing-sync-core.mjs`
- Modify: `site/tests/pricing-sync.test.mjs`
- Modify: `site/data/pricing-source-state.json`
- Modify: `README.md`

**Interfaces:**

- Consumes: Task 1 的 `codingPlans` 中 `sourceUrl`、`officialUrl` 和关键事实字段。
- Produces: `codingPlanSources()`；状态文件中的 `codingPlanPageSources` 与 `codingPlanPriceSources` 映射；检查报告中单独的「个人编程套餐」范围；`fingerprintCodingPlanFacts(plan)`。

- [ ] **Step 1: 写出套餐关键事实指纹的失败测试**

```js
import { fingerprintCodingPlanFacts } from "../scripts/pricing-sync-core.mjs";

test("coding plan catalog fingerprint ignores copy but changes for price facts", () => {
  const current = { id: "cursor-pro", price: { amount: 20, currency: "USD", period: "month" }, includedUsage: { label: "官方额度" }, allowancePolicy: { label: "按官方规则" }, codingSurfaces: ["ide"] };
  expect(fingerprintCodingPlanFacts({ ...current, officialSummary: "新版营销文案" }))
    .toBe(fingerprintCodingPlanFacts(current));
  expect(fingerprintCodingPlanFacts({ ...current, price: { ...current.price, amount: 25 } }))
    .not.toBe(fingerprintCodingPlanFacts(current));
});

test("a coding plan source change is reported as a candidate without rewriting the catalog", async () => {
  const result = await checkPricing({ dryRun: true, codingPlanEntries: [codingPlanSource], fetchImpl: async () => ({ ok: true, text: async () => "Pro $20/month" }) });
  expect(result.codingPlanEntries[0].priceChanged).toBe(true);
});

test("a failed coding plan source leaves state and report untouched", async () => {
  await assert.rejects(checkPricing({ sourceEntries: [codingPlanSource], fetchImpl: async () => ({ ok: false }) }), /source request failed/);
});
```

- [ ] **Step 2: 运行专用同步测试，确认失败**

Run: `npm run test:pricing-sync --prefix site`

Expected: FAIL，提示 `fingerprintCodingPlanFacts` 未导出或套餐来源未加入检查结果。

- [ ] **Step 3: 实现套餐范围的指纹与报告**

```js
export function fingerprintCodingPlanFacts(plan) {
  return fingerprint(JSON.stringify({
    price: plan.price,
    includedUsage: plan.includedUsage,
    allowancePolicy: plan.allowancePolicy,
    codingSurfaces: [...plan.codingSurfaces].sort(),
    officialUrl: plan.officialUrl,
  }));
}
```

`checkPricing` 必须保留现有服务商来源行为，并为套餐来源增加独立状态键与报告分段。对同一 `sourceUrl` 的套餐请求最多抓取一次，再用既有 `extractPricingEvidence(content)` 生成官网价格证据指纹；这只用于发现“候选价格变更”，不从动态页面文本自动写回套餐字段。`fingerprintCodingPlanFacts(plan)` 仅用于目录的结构化关键事实审计。任一自动来源失败时，整个检查抛错且不写入任何状态或报告；显式标记为 `manual` 的套餐来源仅在报告中提示人工核验。`--dry-run` 仍只输出报告而不落盘。更新 README，明确套餐目录的日期是人工核验日期，每日任务只发现候选变化并通过 PR 供审核。

- [ ] **Step 4: 运行同步、前端与构建验证**

Run: `npm run test:pricing-sync --prefix site && npm test --prefix site && npm run build --prefix site`

Expected: 全部 PASS；已有模型价格来源检查与新的套餐来源检查都保留失败不写入语义。

- [ ] **Step 5: 提交本任务**

```bash
git add site/scripts/check-pricing.mjs site/scripts/pricing-sync-core.mjs site/tests/pricing-sync.test.mjs site/data/pricing-source-state.json README.md
git commit -m "feat(套餐): 接入每日官方来源检查"
```

## Task 5: 端到端回归与文档核对

**Files:**

- Modify: `README.md`

**Interfaces:**

- Consumes: Tasks 1–4 的已实现页面、目录和检查命令。
- Produces: 对核心用户路径、数据更新边界和 GitHub Pages 构建的回归证据。

- [ ] **Step 1: 补充公开数据与更新边界说明**

README 添加「个人编程套餐」章节，说明官方来源、未公开字段显示规则和每日检查不会直接自动修改公开数据。

- [ ] **Step 2: 运行完整验证并做本地视觉检查**

Run: `npm run test:pricing-sync --prefix site && npm test --prefix site && GITHUB_ACTIONS=true npm run build --prefix site`

Expected: 所有测试与 GitHub Pages 基础路径构建 PASS。随后运行 `npm run dev --prefix site`，在本地检查桌面和窄屏的套餐表格、筛选按钮、外链和三项清单均可用。

- [ ] **Step 3: 提交本任务**

```bash
git add README.md
git commit -m "test(套餐): 覆盖页面与更新边界"
```

## 计划自检

- 规格覆盖：范围与排除规则由任务 1 实现；精确数据终端、筛选、币种与对比清单由任务 2 和 4 实现；每日关键事实检查与失败保护由任务 3 实现；全量验证由任务 4 执行。
- 占位检查：计划不包含待补充项、模糊步骤或未定义的后续工作。
- 接口一致性：`codingPlans` 是目录唯一输入；Task 1 导出的领域函数被 Task 2 使用；`fingerprintCodingPlanFacts` 由 Task 3 定义并测试；币种继续由 App 的 `state.currency` 单向传入。
