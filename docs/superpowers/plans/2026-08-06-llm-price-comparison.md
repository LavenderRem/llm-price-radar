# 大模型价格对比站 Implementation Plan

> **供智能体执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐任务实施本计划。所有步骤使用复选框跟踪。

**目标：** 构建并部署一个面向中文用户的大模型 API 价格查询、筛选、对比和成本估算网站。

**架构：** 在 `site/` 中使用 Product Design 的 `prototype` 模板构建 React 单页应用。价格数据以人工核验的静态 JavaScript 数据发布，计价、筛选和 URL 序列化保持为无 UI 依赖的纯函数；React 组件只负责交互与展示。完成本地测试、视觉对照和 Sites 构建验证后，再保存并部署 Sites 版本。

**技术栈：** React 19.2、Vite 6.4、Vitest、Testing Library、Decimal.js、Lucide React、CSS、自带 Node.js Sites Worker 测试。

## 全局约束

- 文案和文档默认使用简体中文；模型 ID、API、Token、Batch 等技术词保持原样。
- 视觉以已选方案 1 为唯一源目标：浅色冷灰底、高密度价格表、蓝色与青绿色强调、桌面端固定右侧对比清单。
- 首版只比较按 Token 计费的文本、推理、Embedding 和可统一折算的多模态输入；按张、秒、分钟计费的生成模型不进入主表。
- 初始服务商固定为 OpenAI、Anthropic、Google、DeepSeek、阿里云百炼和智谱开放平台。
- 所有价格必须保存原始币种、原始单位、官方来源、价格生效时间和核验时间。
- 统一展示单位为每百万 Token；人民币和美元换算必须使用带日期和来源的汇率版本。
- 未公开价格显示“未公开”，不得当作零参与排序或估算。
- 最多同时比较三个模型；筛选、排序、币种和对比模型写入 URL。
- 成本估算输入默认只保存在浏览器本地；仅在用户主动分享时写入 URL。
- 首版不增加账号、评论、社区评分、综合能力排名和无人复核的自动抓价。
- 不修改模板中的 `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs` 和 `tests/sites-worker.test.mjs` 的运行契约。
- Product Design 实施阶段必须加载 `image-to-code`，React 编码阶段必须加载 `react-best-practices`，功能开发遵循 `test-driven-development`，完成前使用 `verification-before-completion` 和 Product Design `design-qa`。

---

## 文件结构

```text
site/
├─ .openai/hosting.json                 # Product Design 模板提供，Sites 项目标识
├─ design/reference-option-1.png       # 已选视觉源图
├─ package.json                         # 脚本和依赖
├─ vitest.config.js                     # 单元与组件测试环境
├─ src/
│  ├─ App.jsx                           # 顶层视图、导航和跨模块状态
│  ├─ main.jsx                          # React 入口
│  ├─ styles.css                        # 全局样式、布局、响应式规则
│  ├─ styles/tokens.css                 # 颜色、字号、间距和表格变量
│  ├─ data/catalog.js                   # 服务商、模型和当前价格
│  ├─ data/updates.js                   # 调价、新增、下线和核验记录
│  ├─ data/exchangeRates.js             # 带日期和来源的汇率
│  ├─ domain/catalogValidation.js       # 静态数据校验
│  ├─ domain/pricing.js                 # 单位、汇率、阶梯价格标准化
│  ├─ domain/cost.js                    # 月成本计算
│  ├─ domain/filters.js                 # 搜索、筛选、排序
│  ├─ domain/comparison.js              # 三模型选择上限
│  ├─ domain/urlState.js                # URL 状态编码与解析
│  ├─ hooks/useUrlState.js              # 浏览器历史状态同步
│  └─ components/
│     ├─ AppHeader.jsx                  # 品牌、导航、更新时间、币种切换
│     ├─ FilterBar.jsx                  # 搜索与筛选控件
│     ├─ PricingTable.jsx               # 桌面价格表与移动摘要列表
│     ├─ ComparisonTray.jsx             # 三模型选择清单
│     ├─ ComparisonView.jsx             # 完整并排对比
│     ├─ CostEstimator.jsx              # 用量输入和成本结果
│     ├─ ModelDetail.jsx                # 可链接详情抽屉
│     ├─ UpdatesView.jsx                # 价格更新记录
│     ├─ MethodologyView.jsx            # 计价说明
│     └─ EmptyState.jsx                 # 空结果和错误状态
└─ tests/
   ├─ setup.js
   ├─ catalogValidation.test.js
   ├─ pricing.test.js
   ├─ cost.test.js
   ├─ filters.test.js
   ├─ urlState.test.js
   ├─ pricingTable.test.jsx
   ├─ comparison.test.jsx
   ├─ costEstimator.test.jsx
   └─ appNavigation.test.jsx
```

---

### Task 1：初始化 Product Design 项目与测试基础

**文件：**
- 创建：`site/`（由 Product Design `prototype` 模板生成）
- 创建：`site/design/reference-option-1.png`
- 修改：`site/package.json`
- 创建：`site/vitest.config.js`
- 创建：`site/tests/setup.js`

**接口：**
- 输入：已确认的视觉方案 1、Product Design `prototype` 模板。
- 输出：可启动、可测试、保留 Sites 契约的 React 项目。

- [ ] **Step 1：初始化本地 Git 仓库并生成模板**

执行：

```powershell
Set-Location 'D:\AI\Projects\llm-price'
git init
node 'C:\Users\180841\.codex\plugins\cache\openai-curated-remote\product-design\0.1.52\scripts\bootstrap-prototype.mjs' --mode new --template prototype --root 'D:\AI\Projects\llm-price\site'
```

预期：命令返回 `"status": "created"`，且 `site/.openai/hosting.json`、`site/worker/index.js` 和 `site/src/App.jsx` 存在。

- [ ] **Step 2：保存已选视觉源图**

执行：

```powershell
New-Item -ItemType Directory -Force -Path 'D:\AI\Projects\llm-price\site\design'
Copy-Item -LiteralPath 'C:\Users\180841\.codex\generated_images\019fd511-05ba-7fd3-b298-2c9eb726f6f7\exec-e55e71a9-125a-4e87-82ab-aae187bb5ed7.png' -Destination 'D:\AI\Projects\llm-price\site\design\reference-option-1.png'
```

预期：源图以 1440 × 1024 桌面界面保存，后续视觉 QA 只使用该图作为主参考。

- [ ] **Step 3：安装运行和测试依赖**

执行：

```powershell
Set-Location 'D:\AI\Projects\llm-price\site'
npm install
npm install decimal.js lucide-react
npm install --save-dev vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

修改 `site/package.json`，在 `scripts` 中加入：

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4：配置测试环境并验证初始失败**

创建 `site/vitest.config.js`：

```js
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
  },
});
```

创建 `site/tests/setup.js`：

```js
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

创建临时烟雾测试 `site/tests/appNavigation.test.jsx`：

```jsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App.jsx";

describe("App", () => {
  it("显示产品名称", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "模型价签" })).toBeInTheDocument();
  });
});
```

运行：`npm test -- appNavigation.test.jsx`

预期：FAIL，原因是初始模板还没有“模型价签”标题。

- [ ] **Step 5：添加最小标题并使测试通过**

修改 `site/src/App.jsx`：

```jsx
export function App() {
  return (
    <main>
      <h1>模型价签</h1>
    </main>
  );
}
```

运行：`npm test -- appNavigation.test.jsx`

预期：PASS。

- [ ] **Step 6：提交初始化结果**

```powershell
Set-Location 'D:\AI\Projects\llm-price'
git add docs site
git commit -m "chore: initialize model pricing site"
```

若本机未配置 Git 作者身份，停止在提交命令处并请用户配置；不得代替用户写入虚假姓名或邮箱。

---

### Task 2：建立官方价格目录与数据校验

**文件：**
- 创建：`site/src/data/catalog.js`
- 创建：`site/src/data/exchangeRates.js`
- 创建：`site/src/data/updates.js`
- 创建：`site/src/domain/catalogValidation.js`
- 测试：`site/tests/catalogValidation.test.js`

**接口：**
- 产出：`providers: Provider[]`、`models: Model[]`、`exchangeRates: ExchangeRate[]`、`updates: PriceUpdate[]`。
- 产出：`assertCatalog({ providers, models, exchangeRates }): void`，无效数据时抛出含字段路径的 `Error`。

- [ ] **Step 1：从官方页面核验首批数据**

只使用以下官方入口，并在执行当天记录页面显示的价格、适用条件和核验日期：

```text
OpenAI: https://openai.com/api/pricing/
Anthropic: https://docs.anthropic.com/en/docs/about-claude/pricing
Google: https://ai.google.dev/gemini-api/docs/pricing
DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
阿里云百炼: https://help.aliyun.com/zh/model-studio/model-pricing
智谱开放平台: https://open.bigmodel.cn/ （从官方“API 价格”入口进入具体价格页）
```

每个服务商收录 2–3 个仍在售、具有公开 Token 价格的代表模型。图片、音频和视频输出价格不录入主目录。视觉源图中的数字仅用于布局，不得作为真实价格来源。

- [ ] **Step 2：先写目录校验失败测试**

创建 `site/tests/catalogValidation.test.js`：

```js
import { describe, expect, it } from "vitest";
import { assertCatalog } from "../src/domain/catalogValidation.js";

const providers = [
  { id: "openai", name: "OpenAI", billingCurrency: "USD", officialPricingUrl: "https://openai.com/api/pricing/" },
  { id: "anthropic", name: "Anthropic", billingCurrency: "USD", officialPricingUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing" },
  { id: "google", name: "Google", billingCurrency: "USD", officialPricingUrl: "https://ai.google.dev/gemini-api/docs/pricing" },
  { id: "deepseek", name: "DeepSeek", billingCurrency: "CNY", officialPricingUrl: "https://api-docs.deepseek.com/quick_start/pricing" },
  { id: "aliyun", name: "阿里云百炼", billingCurrency: "CNY", officialPricingUrl: "https://help.aliyun.com/zh/model-studio/model-pricing" },
  { id: "zhipu", name: "智谱", billingCurrency: "CNY", officialPricingUrl: "https://open.bigmodel.cn/" },
];

describe("assertCatalog", () => {
  it("拒绝缺少官方来源的价格版本", () => {
    const models = [{
      id: "demo-model",
      providerId: "openai",
      displayName: "Demo",
      apiModelId: "demo",
      capabilities: ["text"],
      contextWindow: 128000,
      status: "active",
      pricing: [{ currency: "USD", unitTokens: 1000000, input: 1, output: 4 }],
    }];

    expect(() => assertCatalog({ providers, models, exchangeRates: [] }))
      .toThrow("models[0].pricing[0].sourceUrl");
  });
});
```

运行：`npm test -- catalogValidation.test.js`

预期：FAIL，原因是 `catalogValidation.js` 尚不存在。

- [ ] **Step 3：实现明确的数据校验**

创建 `site/src/domain/catalogValidation.js`：

```js
function required(value, path) {
  if (value === undefined || value === null || value === "") {
    throw new Error(path);
  }
}

export function assertCatalog({ providers, models, exchangeRates }) {
  if (!Array.isArray(providers) || providers.length < 6) throw new Error("providers");
  if (!Array.isArray(models) || models.length === 0) throw new Error("models");

  const providerIds = new Set(providers.map((provider) => provider.id));
  for (const [modelIndex, model] of models.entries()) {
    required(model.id, `models[${modelIndex}].id`);
    if (!providerIds.has(model.providerId)) throw new Error(`models[${modelIndex}].providerId`);
    if (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0) {
      throw new Error(`models[${modelIndex}].contextWindow`);
    }
    for (const [priceIndex, price] of model.pricing.entries()) {
      const base = `models[${modelIndex}].pricing[${priceIndex}]`;
      required(price.sourceUrl, `${base}.sourceUrl`);
      required(price.verifiedAt, `${base}.verifiedAt`);
      required(price.effectiveAt, `${base}.effectiveAt`);
      if (price.unitTokens <= 0) throw new Error(`${base}.unitTokens`);
      if (price.input < 0 || price.output < 0) throw new Error(`${base}.price`);
    }
  }

  if (models.length < 12) throw new Error("models.length");

  if (!Array.isArray(exchangeRates) || exchangeRates.length === 0) {
    throw new Error("exchangeRates");
  }
}
```

- [ ] **Step 4：录入结构化数据并补全通过测试**

`site/src/data/catalog.js` 中每个模型使用以下固定字段结构：

```js
export const providers = [
  { id: "openai", name: "OpenAI", billingCurrency: "USD", officialPricingUrl: "https://openai.com/api/pricing/" },
  { id: "anthropic", name: "Anthropic", billingCurrency: "USD", officialPricingUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing" },
  { id: "google", name: "Google", billingCurrency: "USD", officialPricingUrl: "https://ai.google.dev/gemini-api/docs/pricing" },
  { id: "deepseek", name: "DeepSeek", billingCurrency: "CNY", officialPricingUrl: "https://api-docs.deepseek.com/quick_start/pricing" },
  { id: "aliyun", name: "阿里云百炼", billingCurrency: "CNY", officialPricingUrl: "https://help.aliyun.com/zh/model-studio/model-pricing" },
  { id: "zhipu", name: "智谱", billingCurrency: "CNY", officialPricingUrl: "https://open.bigmodel.cn/" },
];

export function defineModel(model) {
  return Object.freeze({ ...model, pricing: model.pricing.map(Object.freeze) });
}
```

在同一文件中导出 `models`，并把 Step 1 核验出的 12–18 个模型逐个写成 `defineModel({...})`。每个对象必须包含：`id`、`providerId`、`displayName`、`apiModelId`、`capabilities`、`contextWindow`、`status` 和至少一个 `pricing` 版本。每个 `pricing` 版本必须包含 `effectiveAt`、`verifiedAt`、`currency`、`unitTokens`、`input`、`output`、`sourceUrl`，并按官方规则选填 `cachedInput`、`cacheWrite`、`batchInput`、`batchOutput`、`batchCachedInput`、`tiers` 和 `conditions`。不得使用视觉稿示例价格，也不得提交空数组或虚构价格。

在测试中追加：

```js
import { providers, models } from "../src/data/catalog.js";
import { exchangeRates } from "../src/data/exchangeRates.js";

it("接受六家服务商的完整目录", () => {
  expect(() => assertCatalog({ providers, models, exchangeRates })).not.toThrow();
  expect(new Set(models.map((model) => model.providerId)).size).toBe(6);
});
```

运行：`npm test -- catalogValidation.test.js`

预期：PASS。

- [ ] **Step 5：建立汇率和更新记录**

创建 `site/src/data/exchangeRates.js`，使用实施当天可追溯的公开汇率来源。导出的唯一首版记录固定包含 `baseCurrency: "USD"`、`quoteCurrency: "CNY"`、当天真实正数 `rate`、ISO 日期 `effectiveAt` 和实际 `https://` 来源 URL。校验测试必须断言 `rate > 0`、`effectiveAt` 可解析且 `source` 以 `https://` 开头，禁止提交零汇率或说明文字代替 URL。

创建 `site/src/data/updates.js`，为首批数据生成“新增模型”和“价格核验”记录；每条记录包含 `id`、`modelId`、`type`、`effectiveAt`、`verifiedAt`、`summary`、`sourceUrl`。

- [ ] **Step 6：提交数据基础**

```powershell
git add site/src/data site/src/domain/catalogValidation.js site/tests/catalogValidation.test.js
git commit -m "feat: add verified model pricing catalog"
```

---

### Task 3：实现价格标准化与成本计算引擎

**文件：**
- 创建：`site/src/domain/pricing.js`
- 创建：`site/src/domain/cost.js`
- 测试：`site/tests/pricing.test.js`
- 测试：`site/tests/cost.test.js`

**接口：**
- 产出：`normalizePricing(price, targetCurrency, exchangeRates): NormalizedPricing`
- 产出：`selectPriceTier(price, averageInputTokens): PriceTier`
- 产出：`normalizeModel(model, targetCurrency, exchangeRates, providers, averageInputTokens = 0): ModelView`
- 产出：`calculateMonthlyCost(price, usage): CostBreakdown`
- `usage` 固定为 `{ monthlyRequests, averageInputTokens, averageOutputTokens, cacheHitRate, batchShare }`。

- [ ] **Step 1：编写标准化失败测试**

创建 `site/tests/pricing.test.js`：

```js
import { describe, expect, it } from "vitest";
import { normalizePricing, selectPriceTier } from "../src/domain/pricing.js";

describe("normalizePricing", () => {
  it("把每千 Token 美元价换算为每百万 Token 人民币价", () => {
    const result = normalizePricing(
      { currency: "USD", unitTokens: 1000, input: 0.002, output: 0.008 },
      "CNY",
      [{ baseCurrency: "USD", quoteCurrency: "CNY", rate: 7.2 }],
    );
    expect(result.input).toBe(14.4);
    expect(result.output).toBe(57.6);
    expect(result.unitTokens).toBe(1000000);
  });

  it("按平均输入长度选择阶梯价", () => {
    const tier = selectPriceTier({ tiers: [
      { maxInputTokens: 200000, input: 3, output: 15 },
      { minInputTokens: 200001, input: 6, output: 22.5 },
    ] }, 250000);
    expect(tier.input).toBe(6);
  });
});
```

运行：`npm test -- pricing.test.js`

预期：FAIL，原因是模块尚不存在。

- [ ] **Step 2：实现价格标准化**

创建 `site/src/domain/pricing.js`：

```js
import Decimal from "decimal.js";

function exchangeMultiplier(from, to, exchangeRates) {
  if (from === to) return new Decimal(1);
  const direct = exchangeRates.find((rate) => rate.baseCurrency === from && rate.quoteCurrency === to);
  if (direct) return new Decimal(direct.rate);
  const inverse = exchangeRates.find((rate) => rate.baseCurrency === to && rate.quoteCurrency === from);
  if (inverse) return new Decimal(1).div(inverse.rate);
  throw new Error(`缺少 ${from}/${to} 汇率`);
}

export function selectPriceTier(price, averageInputTokens) {
  if (!price.tiers?.length) return price;
  const tier = price.tiers.find((item) =>
    (item.minInputTokens === undefined || averageInputTokens >= item.minInputTokens) &&
    (item.maxInputTokens === undefined || averageInputTokens <= item.maxInputTokens));
  if (!tier) throw new Error("没有匹配的价格阶梯");
  return { ...price, ...tier, tiers: price.tiers };
}

export function normalizePricing(price, targetCurrency, exchangeRates) {
  const multiplier = exchangeMultiplier(price.currency, targetCurrency, exchangeRates);
  const unitMultiplier = new Decimal(1000000).div(price.unitTokens);
  const convert = (value) => value === undefined
    ? undefined
    : Number(new Decimal(value).mul(unitMultiplier).mul(multiplier).toDecimalPlaces(8));
  return {
    ...price,
    currency: targetCurrency,
    unitTokens: 1000000,
    input: convert(price.input),
    output: convert(price.output),
    cachedInput: convert(price.cachedInput),
    cacheWrite: convert(price.cacheWrite),
    batchInput: convert(price.batchInput),
    batchOutput: convert(price.batchOutput),
    batchCachedInput: convert(price.batchCachedInput),
  };
}

export function normalizeModel(model, targetCurrency, exchangeRates, providers, averageInputTokens = 0) {
  const currentPrice = model.pricing[0];
  const tier = selectPriceTier(currentPrice, averageInputTokens);
  const normalized = normalizePricing(tier, targetCurrency, exchangeRates);
  return {
    ...model,
    providerName: providers.find((provider) => provider.id === model.providerId)?.name ?? model.providerId,
    normalized: {
      ...normalized,
      blended: Number(new Decimal(normalized.input).mul(0.7)
        .plus(new Decimal(normalized.output).mul(0.3)).toDecimalPlaces(8)),
    },
  };
}
```

运行：`npm test -- pricing.test.js`

预期：PASS。

- [ ] **Step 3：编写成本计算失败测试**

创建 `site/tests/cost.test.js`：

```js
import { describe, expect, it } from "vitest";
import { calculateMonthlyCost } from "../src/domain/cost.js";

describe("calculateMonthlyCost", () => {
  it("分别计算普通、缓存、Batch 输入和输出成本", () => {
    const result = calculateMonthlyCost(
      {
        unitTokens: 1000000,
        input: 2,
        output: 8,
        cachedInput: 0.5,
        batchInput: 1,
        batchOutput: 4,
        batchCachedInput: 0.25,
      },
      {
        monthlyRequests: 1000,
        averageInputTokens: 1000,
        averageOutputTokens: 500,
        cacheHitRate: 0.5,
        batchShare: 0.4,
      },
    );
    expect(result.total).toBe(4.2);
    expect(result.inputTotal).toBe(1);
    expect(result.outputTotal).toBe(3.2);
  });
});
```

运行：`npm test -- cost.test.js`

预期：FAIL，原因是成本模块尚不存在。

- [ ] **Step 4：实现高精度成本计算**

创建 `site/src/domain/cost.js`：

```js
import Decimal from "decimal.js";

export function calculateMonthlyCost(price, usage) {
  const unit = new Decimal(price.unitTokens);
  const requests = new Decimal(usage.monthlyRequests);
  const inputTokens = requests.mul(usage.averageInputTokens);
  const outputTokens = requests.mul(usage.averageOutputTokens);
  const cacheShare = new Decimal(usage.cacheHitRate);
  const batchShare = new Decimal(usage.batchShare);
  const normalShare = new Decimal(1).minus(batchShare);

  const uncached = inputTokens.mul(new Decimal(1).minus(cacheShare));
  const cached = inputTokens.mul(cacheShare);
  const normalInput = uncached.mul(normalShare).mul(price.input).div(unit);
  const normalCached = cached.mul(normalShare).mul(price.cachedInput ?? price.input).div(unit);
  const batchInput = uncached.mul(batchShare).mul(price.batchInput ?? price.input).div(unit);
  const batchCached = cached.mul(batchShare).mul(
    price.batchCachedInput ?? price.batchInput ?? price.cachedInput ?? price.input,
  ).div(unit);
  const normalOutput = outputTokens.mul(normalShare).mul(price.output).div(unit);
  const batchOutput = outputTokens.mul(batchShare).mul(price.batchOutput ?? price.output).div(unit);
  const inputTotal = normalInput.plus(normalCached).plus(batchInput).plus(batchCached);
  const outputTotal = normalOutput.plus(batchOutput);

  return {
    normalInput: Number(normalInput.toDecimalPlaces(8)),
    cachedInput: Number(normalCached.toDecimalPlaces(8)),
    batchInput: Number(batchInput.plus(batchCached).toDecimalPlaces(8)),
    output: Number(outputTotal.toDecimalPlaces(8)),
    inputTotal: Number(inputTotal.toDecimalPlaces(8)),
    outputTotal: Number(outputTotal.toDecimalPlaces(8)),
    total: Number(inputTotal.plus(outputTotal).toDecimalPlaces(8)),
  };
}
```

运行：`npm test -- pricing.test.js cost.test.js`

预期：PASS。

- [ ] **Step 5：补充边界测试并提交**

为 0%/100% 缓存、0%/100% Batch、缺少优惠价格回退、阶梯边界、缺失汇率分别增加断言。运行：`npm test -- pricing.test.js cost.test.js`，预期全部 PASS。

```powershell
git add site/src/domain/pricing.js site/src/domain/cost.js site/tests/pricing.test.js site/tests/cost.test.js
git commit -m "feat: add pricing normalization and cost engine"
```

---

### Task 4：实现筛选、排序和 URL 状态

**文件：**
- 创建：`site/src/domain/filters.js`
- 创建：`site/src/domain/urlState.js`
- 创建：`site/src/hooks/useUrlState.js`
- 测试：`site/tests/filters.test.js`
- 测试：`site/tests/urlState.test.js`

**接口：**
- 产出：`filterAndSortModels(models, state): Model[]`
- 产出：`parseUrlState(search): CatalogState`
- 产出：`serializeUrlState(state): string`
- `CatalogState` 固定字段：`query`、`providers`、`capabilities`、`minContext`、`hasCache`、`hasBatch`、`sortBy`、`sortDirection`、`currency`、`compareIds`、`detailId`。

- [ ] **Step 1：编写组合筛选失败测试**

创建 `site/tests/filters.test.js`：

```js
import { describe, expect, it } from "vitest";
import { filterAndSortModels } from "../src/domain/filters.js";

const models = [
  { id: "fast", providerId: "google", displayName: "Flash", capabilities: ["text"], contextWindow: 1000000, normalized: { input: 0.2, output: 1 } },
  { id: "reason", providerId: "deepseek", displayName: "Reasoner", capabilities: ["reasoning"], contextWindow: 128000, normalized: { input: 0.5, output: 2 } },
];

it("组合服务商、能力和上下文筛选", () => {
  const result = filterAndSortModels(models, {
    query: "reason",
    providers: ["deepseek"],
    capabilities: ["reasoning"],
    minContext: 100000,
    sortBy: "input",
    sortDirection: "asc",
  });
  expect(result.map((model) => model.id)).toEqual(["reason"]);
});
```

运行：`npm test -- filters.test.js`，预期 FAIL。

- [ ] **Step 2：实现组合筛选和稳定排序**

创建 `site/src/domain/filters.js`：

```js
export function filterAndSortModels(models, state) {
  const query = state.query?.trim().toLowerCase() ?? "";
  const result = models.filter((model) => {
    const matchesQuery = !query || `${model.displayName} ${model.apiModelId} ${model.providerId}`.toLowerCase().includes(query);
    const matchesProvider = !state.providers?.length || state.providers.includes(model.providerId);
    const matchesCapabilities = !state.capabilities?.length || state.capabilities.every((item) => model.capabilities.includes(item));
    const matchesContext = !state.minContext || model.contextWindow >= state.minContext;
    const price = model.normalized;
    const matchesCache = !state.hasCache || price.cachedInput !== undefined;
    const matchesBatch = !state.hasBatch || price.batchInput !== undefined || price.batchOutput !== undefined;
    return model.status === "active" && matchesQuery && matchesProvider && matchesCapabilities && matchesContext && matchesCache && matchesBatch;
  });

  const direction = state.sortDirection === "desc" ? -1 : 1;
  const key = state.sortBy === "output" ? "output" : state.sortBy === "blended" ? "blended" : "input";
  return result.map((model, index) => ({ model, index })).sort((a, b) => {
    const aValue = a.model.normalized[key] ?? Number.POSITIVE_INFINITY;
    const bValue = b.model.normalized[key] ?? Number.POSITIVE_INFINITY;
    return aValue === bValue ? a.index - b.index : (aValue - bValue) * direction;
  }).map(({ model }) => model);
}
```

- [ ] **Step 3：编写 URL 往返测试**

创建 `site/tests/urlState.test.js`：

```js
import { expect, it } from "vitest";
import { parseUrlState, serializeUrlState } from "../src/domain/urlState.js";

it("序列化后恢复筛选和三个对比模型", () => {
  const state = {
    query: "mini",
    providers: ["openai", "google"],
    capabilities: ["text"],
    minContext: 128000,
    hasCache: true,
    hasBatch: false,
    sortBy: "output",
    sortDirection: "asc",
    currency: "CNY",
    compareIds: ["a", "b", "c"],
    detailId: "a",
  };
  expect(parseUrlState(serializeUrlState(state))).toEqual(state);
});
```

运行：`npm test -- urlState.test.js`，预期 FAIL。

- [ ] **Step 4：实现 URL 编码、解析和历史同步**

`site/src/domain/urlState.js` 使用 `URLSearchParams`；数组字段使用逗号分隔，`compareIds` 解析时截断为三个，未知币种回退到 `CNY`，未知排序字段回退到 `input`：

```js
const split = (value) => value ? value.split(",").filter(Boolean) : [];

export function parseUrlState(search) {
  const params = new URLSearchParams(search);
  const sortBy = ["input", "output", "blended"].includes(params.get("sort")) ? params.get("sort") : "input";
  return {
    query: params.get("q") ?? "",
    providers: split(params.get("providers")),
    capabilities: split(params.get("capabilities")),
    minContext: Number(params.get("context") ?? 0),
    hasCache: params.get("cache") === "1",
    hasBatch: params.get("batch") === "1",
    sortBy,
    sortDirection: params.get("direction") === "desc" ? "desc" : "asc",
    currency: params.get("currency") === "USD" ? "USD" : "CNY",
    compareIds: split(params.get("compare")).slice(0, 3),
    detailId: params.get("detail") ?? "",
  };
}

export function serializeUrlState(state) {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.providers.length) params.set("providers", state.providers.join(","));
  if (state.capabilities.length) params.set("capabilities", state.capabilities.join(","));
  if (state.minContext) params.set("context", String(state.minContext));
  if (state.hasCache) params.set("cache", "1");
  if (state.hasBatch) params.set("batch", "1");
  params.set("sort", state.sortBy);
  params.set("direction", state.sortDirection);
  params.set("currency", state.currency);
  if (state.compareIds.length) params.set("compare", state.compareIds.slice(0, 3).join(","));
  if (state.detailId) params.set("detail", state.detailId);
  return `?${params.toString()}`;
}
```

创建 `site/src/hooks/useUrlState.js`：

```js
import { useEffect, useState } from "react";
import { parseUrlState, serializeUrlState } from "../domain/urlState.js";

export function useUrlState(initialState) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    window.history.replaceState(null, "", serializeUrlState(state));
  }, [state]);

  useEffect(() => {
    const restore = () => setState(parseUrlState(window.location.search));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  return [state, setState];
}
```

运行：`npm test -- filters.test.js urlState.test.js`，预期 PASS。

- [ ] **Step 5：提交筛选基础**

```powershell
git add site/src/domain/filters.js site/src/domain/urlState.js site/src/hooks/useUrlState.js site/tests/filters.test.js site/tests/urlState.test.js
git commit -m "feat: add catalog filters and shareable URL state"
```

---

### Task 5：实现应用外壳、筛选栏和价格总表

**文件：**
- 修改：`site/src/App.jsx`
- 创建：`site/src/components/AppHeader.jsx`
- 创建：`site/src/components/FilterBar.jsx`
- 创建：`site/src/components/PricingTable.jsx`
- 创建：`site/src/components/EmptyState.jsx`
- 创建：`site/src/styles/tokens.css`
- 修改：`site/src/styles.css`
- 测试：`site/tests/pricingTable.test.jsx`
- 修改：`site/tests/appNavigation.test.jsx`

**接口：**
- `PricingTable({ models, currency, selectedIds, onToggleCompare, onOpenDetail, sortBy, sortDirection, onSort })`
- `FilterBar({ state, providers, onChange, onClear })`
- `AppHeader({ view, currency, verifiedAt, onViewChange, onCurrencyChange })`

- [ ] **Step 1：编写价格表交互失败测试**

创建 `site/tests/pricingTable.test.jsx`：

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PricingTable } from "../src/components/PricingTable.jsx";

it("选择模型并触发输入价格排序", async () => {
  const onToggleCompare = vi.fn();
  const onSort = vi.fn();
  render(<PricingTable
    models={[{ id: "m1", providerName: "OpenAI", displayName: "Model 1", capabilities: ["text"], contextWindow: 128000, normalized: { input: 2, output: 8 } }]}
    currency="CNY"
    selectedIds={[]}
    onToggleCompare={onToggleCompare}
    onOpenDetail={() => {}}
    sortBy="input"
    sortDirection="asc"
    onSort={onSort}
  />);
  await userEvent.click(screen.getByRole("checkbox", { name: /Model 1/ }));
  await userEvent.click(screen.getByRole("button", { name: /输入价格/ }));
  expect(onToggleCompare).toHaveBeenCalledWith("m1");
  expect(onSort).toHaveBeenCalledWith("input");
});
```

运行：`npm test -- pricingTable.test.jsx`，预期 FAIL。

- [ ] **Step 2：建立视觉 Token 和页面骨架**

创建 `site/src/styles/tokens.css`：

```css
:root {
  color-scheme: light;
  --bg: #f7f9fc;
  --surface: #ffffff;
  --text: #10233f;
  --muted: #6f7d91;
  --line: #dfe5ed;
  --primary: #2979ff;
  --accent: #1bc6c2;
  --danger: #e35656;
  --radius-sm: 8px;
  --radius-md: 12px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --font-ui: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-number: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
}
```

`site/src/styles.css` 导入 Token，设置全局 `box-sizing`、14–16px 正文字号、固定表头、桌面两栏布局和可见焦点。不得添加营销 Hero、渐变背景或大尺寸 KPI 卡片。

- [ ] **Step 3：实现语义化价格表与移动摘要**

`PricingTable` 使用真实 `<table>`、`<thead>`、`<th scope="col">`，排序按钮设置 `aria-sort`；选择框的名称包含模型名。价格单元格同时显示数值、币种和“每百万 Token”。未公开字段输出文字“未公开”，并从排序值中排除。

桌面端列与视觉源图一致；在小于 768 像素时隐藏表格并渲染语义化模型摘要列表，保留选择、详情、输入价和输出价。

- [ ] **Step 4：实现筛选栏和顶层状态**

`App.jsx` 的数据流固定为：

```jsx
const [state, setState] = useUrlState(parseUrlState(window.location.search));
const normalizedModels = models.map((model) => normalizeModel(model, state.currency, exchangeRates, providers));
const visibleModels = filterAndSortModels(normalizedModels, state);
```

`FilterBar` 提供搜索、服务商多选、能力多选、上下文、缓存、Batch 和清除筛选；所有控件使用可见标签。搜索输入使用 150 毫秒延迟更新 URL，复选和排序立即更新。

- [ ] **Step 5：完成空状态和导航测试**

当 `visibleModels.length === 0` 时显示“没有符合条件的模型”和“清除筛选”按钮。补充 `appNavigation.test.jsx`，断言“价格对比”“成本估算”“更新记录”三个导航按钮可通过键盘切换活动视图。

运行：

```powershell
npm test -- pricingTable.test.jsx appNavigation.test.jsx
```

预期：PASS。

- [ ] **Step 6：提交价格目录界面**

```powershell
git add site/src/App.jsx site/src/components site/src/styles.css site/src/styles site/tests/pricingTable.test.jsx site/tests/appNavigation.test.jsx
git commit -m "feat: build searchable pricing catalog"
```

---

### Task 6：实现三模型对比与分享

**文件：**
- 创建：`site/src/domain/comparison.js`
- 创建：`site/src/components/ComparisonTray.jsx`
- 创建：`site/src/components/ComparisonView.jsx`
- 测试：`site/tests/comparison.test.jsx`
- 修改：`site/src/App.jsx`

**接口：**
- `ComparisonTray({ models, selectedIds, onRemove, onOpenComparison })`
- `ComparisonView({ models, currency, onClose, onRemove, onCopyLink })`
- `toggleComparison(selectedIds, modelId): { ids, limitReached }`

- [ ] **Step 1：编写三模型上限失败测试**

创建 `site/tests/comparison.test.jsx`，覆盖：选择第四个模型时保持前三个不变并显示“最多选择 3 个模型”；移除一个后可以新增；复制链接包含三个模型 ID。

核心纯函数测试：

```js
expect(toggleComparison(["a", "b", "c"], "d")).toEqual({
  ids: ["a", "b", "c"],
  limitReached: true,
});
```

运行：`npm test -- comparison.test.jsx`，预期 FAIL。

- [ ] **Step 2：实现选择规则和固定清单**

创建 `site/src/domain/comparison.js`：

```js
export function toggleComparison(selectedIds, modelId) {
  if (selectedIds.includes(modelId)) {
    return { ids: selectedIds.filter((id) => id !== modelId), limitReached: false };
  }
  if (selectedIds.length >= 3) return { ids: selectedIds, limitReached: true };
  return { ids: [...selectedIds, modelId], limitReached: false };
}
```

桌面端 `ComparisonTray` 固定在表格右侧，显示模型名、输入/输出价格、移除按钮、月成本摘要入口和“查看对比详情”。没有选择时说明“最多选择 3 个模型进行对比”。达到上限时使用 `role="status"` 宣布限制。

- [ ] **Step 3：实现完整对比视图**

`ComparisonView` 按行比较：标准输入、标准输出、缓存输入、Batch 输入/输出、上下文窗口、能力、计费条件、核验日期和官方来源。数值最小项可以使用青绿色背景，但同时显示“当前最低价”文字，不暗示能力胜者。

- [ ] **Step 4：实现分享链接**

点击“复制对比链接”时用 `serializeUrlState` 生成当前 URL，通过 `navigator.clipboard.writeText` 写入剪贴板，并显示“链接已复制”。组件测试模拟 `navigator.clipboard` 并断言复制内容可由 `parseUrlState` 恢复。

运行：`npm test -- comparison.test.jsx urlState.test.js`，预期 PASS。

- [ ] **Step 5：提交对比功能**

```powershell
git add site/src/App.jsx site/src/domain/comparison.js site/src/components/ComparisonTray.jsx site/src/components/ComparisonView.jsx site/tests/comparison.test.jsx
git commit -m "feat: add three-model comparison and sharing"
```

---

### Task 7：实现成本估算器

**文件：**
- 创建：`site/src/components/CostEstimator.jsx`
- 测试：`site/tests/costEstimator.test.jsx`
- 修改：`site/src/App.jsx`

**接口：**
- `CostEstimator({ models, selectedIds, currency, onShare })`
- 表单状态固定为 `monthlyRequests`、`averageInputTokens`、`averageOutputTokens`、`cacheHitRatePercent`、`batchSharePercent`、`baselineModelId`。

- [ ] **Step 1：编写估算交互失败测试**

创建 `site/tests/costEstimator.test.jsx`：输入 1000 次请求、1000 输入 Token、500 输出 Token、50% 缓存和 40% Batch，断言页面展示由 `calculateMonthlyCost` 返回的月成本，并对不支持缓存的模型显示“按标准输入价计算”。

运行：`npm test -- costEstimator.test.jsx`，预期 FAIL。

- [ ] **Step 2：实现数值输入和本地持久化**

所有输入使用 `inputMode="numeric"` 或 `type="number"`，限制非负数；百分比限制为 0–100。使用键 `model-price-estimator-v1` 保存到 `localStorage`。解析失败时回退到以下默认值：

```js
{
  monthlyRequests: 100000,
  averageInputTokens: 2000,
  averageOutputTokens: 800,
  cacheHitRatePercent: 0,
  batchSharePercent: 0,
  baselineModelId: "",
}
```

- [ ] **Step 3：实现成本结果和基准差额**

对选中的模型调用 `selectPriceTier`、`normalizePricing` 和 `calculateMonthlyCost`。结果逐项显示普通输入、缓存输入、Batch、输出和总成本；设置基准后显示差额与百分比。缺少公开价格的模型显示“无法估算”，不输出零成本。

- [ ] **Step 4：实现主动分享估算**

只有点击“分享估算”时，才把表单值编码为 `estimate` 查询参数；默认 URL 状态更新不得包含业务调用量。分享按钮旁说明“链接将包含当前调用量参数”。

运行：`npm test -- costEstimator.test.jsx cost.test.js urlState.test.js`，预期 PASS。

- [ ] **Step 5：提交估算器**

```powershell
git add site/src/App.jsx site/src/components/CostEstimator.jsx site/tests/costEstimator.test.jsx
git commit -m "feat: add monthly model cost estimator"
```

---

### Task 8：实现模型详情、更新记录和计价说明

**文件：**
- 创建：`site/src/components/ModelDetail.jsx`
- 创建：`site/src/components/UpdatesView.jsx`
- 创建：`site/src/components/MethodologyView.jsx`
- 修改：`site/src/App.jsx`
- 修改：`site/tests/appNavigation.test.jsx`

**接口：**
- `ModelDetail({ model, currency, onClose, onAddToComparison })`
- `UpdatesView({ updates, providers })`
- `MethodologyView({ exchangeRate })`

- [ ] **Step 1：编写详情和导航失败测试**

在 `appNavigation.test.jsx` 增加以下断言：打开模型详情后显示 API 模型 ID、计费条件、官方来源和核验日期；关闭后焦点返回原来的详情按钮；进入更新记录可按服务商和“价格下降”过滤；计价说明显示汇率来源和免责声明。

运行：`npm test -- appNavigation.test.jsx`，预期 FAIL。

- [ ] **Step 2：实现可链接详情抽屉**

详情使用 `role="dialog"`、可见标题和关闭按钮；打开时把 `detailId` 写入 URL，关闭时清除。抽屉列出所有价格版本和阶梯条件。官方来源使用新的安全标签页打开：`target="_blank" rel="noreferrer"`。

- [ ] **Step 3：实现更新记录**

更新记录按 `effectiveAt` 降序；支持服务商和事件类型筛选。上涨、下降、新增、下线和仅核验同时使用文字标签与图标。已下线模型只在此视图和详情中出现。

- [ ] **Step 4：实现计价说明**

计价说明必须包含：统一为每百万 Token 的原因、汇率值/日期/来源、输入/输出/缓存/Batch 定义、阶梯价处理、推理 Token 说明、不同模态不直接比较的原因，以及“最终价格以服务商官方页面为准”。

- [ ] **Step 5：验证并提交**

运行：`npm test -- appNavigation.test.jsx`

预期：PASS。

```powershell
git add site/src/App.jsx site/src/components/ModelDetail.jsx site/src/components/UpdatesView.jsx site/src/components/MethodologyView.jsx site/tests/appNavigation.test.jsx
git commit -m "feat: add model details updates and methodology"
```

---

### Task 9：完成响应式、无障碍和视觉对照

**文件：**
- 修改：`site/src/styles.css`
- 修改：`site/src/components/AppHeader.jsx`
- 修改：`site/src/components/FilterBar.jsx`
- 修改：`site/src/components/PricingTable.jsx`
- 修改：`site/src/components/ComparisonTray.jsx`
- 修改：`site/src/components/CostEstimator.jsx`
- 修改：`site/src/components/ModelDetail.jsx`
- 创建：`site/design/qa-desktop.png`
- 创建：`site/design/qa-mobile.png`

**接口：**
- 输入：`site/design/reference-option-1.png` 和本地运行界面。
- 输出：无裁切、可键盘操作、与方案 1 层级一致的桌面和移动界面。

- [ ] **Step 1：启动本地服务并打开内置浏览器**

执行：

```powershell
Set-Location 'D:\AI\Projects\llm-price\site'
npm run dev -- --host 0.0.0.0
```

使用 Codex Desktop 的内置浏览器访问本地页面。不得改用 Playwright CLI，除非用户明确允许或内置浏览器不可用。

- [ ] **Step 2：检查三个响应式断点**

检查 1440 × 1024、1024 × 768、390 × 844：

- 1440：完整表格和右侧固定对比清单同时可见。
- 1024：隐藏缓存或 Batch 等次要列，详情仍可访问完整信息。
- 390：使用摘要列表；筛选和对比通过全屏抽屉打开；不得出现页面级横向滚动。

在 `site/src/styles.css` 中使用以下断点：

```css
@media (max-width: 1199px) {
  .catalog-layout { grid-template-columns: minmax(0, 1fr); }
  .comparison-tray { position: fixed; inset: auto 16px 16px 16px; z-index: 20; }
  .pricing-table .column-secondary { display: none; }
}

@media (max-width: 767px) {
  .pricing-table { display: none; }
  .pricing-list { display: grid; gap: 12px; }
  .filter-bar { grid-template-columns: 1fr; }
  .drawer { inset: 0; width: 100%; border-radius: 0; }
}
```

- [ ] **Step 3：执行键盘和无障碍检查**

验证 Tab 顺序、可见焦点、表格列头、排序状态、抽屉焦点返回、状态播报、表单标签和颜色对比。任何“上涨”“下降”“最低价”“错误”必须同时有文字。使用浏览器控制台确认没有 React 警告或运行错误。

- [ ] **Step 4：执行 Product Design 视觉 QA**

加载 Product Design `design-qa`，以相同 1440 × 1024 视口分别捕获参考图和实现图，放入同一次对比判断。逐项修复：顶部导航高度、筛选栏间距、表格列宽、数字对齐、行高、右侧清单宽度、颜色、边框、圆角、裁切和字号。

修复后重新捕获，直至没有明显结构差异。另存最终桌面和移动截图为：

```text
site/design/qa-desktop.png
site/design/qa-mobile.png
```

- [ ] **Step 5：运行全量测试并提交**

```powershell
npm test
npm run build
npm run test:sites
git add site
git commit -m "fix: complete responsive and visual QA"
```

预期：所有测试 PASS；构建生成 `dist/client/index.html`、`dist/server/index.js` 和 `dist/.openai/hosting.json`。

---

### Task 10：保存并部署 Sites 生产版本

**文件：**
- 读取并按 Sites 返回值更新：`site/.openai/hosting.json`
- 生成：Sites 部署归档文件

**接口：**
- 输入：通过测试的 Git HEAD、Sites 项目 ID 和构建归档。
- 输出：状态为 `succeeded` 的 Sites 生产 URL。

- [ ] **Step 1：完成发布前验证**

加载 `verification-before-completion` 和 Product Design `share`。执行：

```powershell
Set-Location 'D:\AI\Projects\llm-price\site'
npm test
npm run build
npm run test:sites
git -C 'D:\AI\Projects\llm-price' status --short
git -C 'D:\AI\Projects\llm-price' rev-parse HEAD
```

预期：测试和构建通过；工作树无未提交的站点变更；记录当前完整 commit SHA。

- [ ] **Step 2：创建或复用 Sites 项目**

先读取 `site/.openai/hosting.json`：

- 若存在非空 `project_id`，原样复用，禁止再次创建站点。
- 若没有 `project_id`，调用 Sites `create_site`，参数固定为：`title: "模型价签"`、`slug: "model-price-radar"`、`description: "大模型 API 价格对比与成本估算"`；立即把返回的站点 `id` 原样写入 `project_id`。

按 Sites 返回的短期凭据使用单次 Git 认证推送当前 HEAD；不得把 token 写入 Git remote、配置文件、日志或文档。

- [ ] **Step 3：生成与 HEAD 一致的部署归档**

从已提交的当前 HEAD 构建归档，归档必须包含可部署的 `dist` 结构和有效的 `.openai/hosting.json`。计算并记录归档路径，但不把归档提交到 Git。

再次运行 `git rev-parse HEAD`，确保传给 Sites 的 `commit_sha` 与归档来源完全一致。

- [ ] **Step 4：保存站点版本并部署**

调用 Sites `save_site_version`：

```text
project_id = hosting.json 中的原始 project_id
commit_sha = 当前 HEAD 完整 SHA
archive = 部署归档绝对路径
```

保留返回的 `version_id` 和版本号。随后调用 `deploy_site_version(project_id, version_id)`。如果返回 `pending`、`building` 或 `publishing`，使用同一组 `project_id`、`version_id` 和返回的 `deployment_id` 调用 `get_deployment_status`，直到 `succeeded` 或 `failed`。

- [ ] **Step 5：验证生产站点并交付**

在内置浏览器打开生产 URL，验证：价格表、筛选、三模型对比、成本估算、详情、更新记录、移动端布局和官方来源链接。若部署失败，报告失败信息及站点、版本、部署 ID，不得虚构可用 URL。

成功后向用户返回生产 URL、版本号、数据核验日期和已覆盖的六家服务商。

---

## 最终验证命令

在 `D:\AI\Projects\llm-price\site` 中执行：

```powershell
npm test
npm run build
npm run test:sites
```

全部成功后，再确认：

```powershell
git -C 'D:\AI\Projects\llm-price' status --short
git -C 'D:\AI\Projects\llm-price' log --oneline -10
```

预期：工作树干净；每个功能任务有独立提交；Sites 使用的 `commit_sha` 与最终 HEAD 一致。
