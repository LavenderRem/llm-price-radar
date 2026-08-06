import { useEffect, useMemo, useState } from "react";
import { exchangeRates } from "../data/exchangeRates.js";
import { calculateMonthlyCost } from "../domain/cost.js";
import { normalizePricing, selectPriceTier } from "../domain/pricing.js";

const storageKey = "model-price-estimator-v1";
const defaults = {
  monthlyRequests: 100000,
  averageInputTokens: 2000,
  averageOutputTokens: 800,
  cacheHitRatePercent: 0,
  batchSharePercent: 0,
  baselineModelId: "",
};

const numberFields = [
  "monthlyRequests",
  "averageInputTokens",
  "averageOutputTokens",
  "cacheHitRatePercent",
  "batchSharePercent",
];

function clamp(value, maximum = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), maximum);
}

function normalizeValues(source) {
  if (!source || typeof source !== "object") return defaults;
  return {
    ...defaults,
    ...Object.fromEntries(numberFields
      .filter((field) => Number.isFinite(Number(source[field])))
      .map((field) => [field, clamp(source[field], field.endsWith("Percent") ? 100 : undefined)])),
    baselineModelId: typeof source.baselineModelId === "string" ? source.baselineModelId : "",
  };
}

function readStoredValues() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey));
    return normalizeValues(stored);
  } catch {
    return defaults;
  }
}

function readInitialValues() {
  try {
    const estimate = new URLSearchParams(window.location.search).get("estimate");
    if (estimate) return normalizeValues(JSON.parse(estimate));
  } catch {
    // An invalid shared link must not prevent a local estimate from opening.
  }
  return readStoredValues();
}

function formatMoney(value, currency) {
  const symbol = currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function estimateModel(model, values, currency) {
  const price = model.pricing?.[0];
  if (!price || typeof price.input !== "number" || typeof price.output !== "number") return null;

  try {
    const tier = selectPriceTier(price, values.averageInputTokens);
    const normalized = normalizePricing(tier, currency, exchangeRates);
    const supportsCache = typeof normalized.cachedInput === "number";
    const supportsBatch = typeof normalized.batchInput === "number" || typeof normalized.batchOutput === "number";
    const cost = calculateMonthlyCost(normalized, {
      monthlyRequests: values.monthlyRequests,
      averageInputTokens: values.averageInputTokens,
      averageOutputTokens: values.averageOutputTokens,
      cacheHitRate: values.cacheHitRatePercent / 100,
      batchShare: values.batchSharePercent / 100,
    });

    return { model, cost, supportsCache, supportsBatch };
  } catch {
    return null;
  }
}

function NumberField({ label, value, maximum, onChange }) {
  return (
    <label className="estimator-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        inputMode="numeric"
        min="0"
        max={maximum}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {maximum ? <small>0–{maximum}%</small> : null}
    </label>
  );
}

export function CostEstimator({ models, selectedIds, currency, onShare }) {
  const [values, setValues] = useState(readInitialValues);
  const [shareMessage, setShareMessage] = useState("");
  const selectedModels = useMemo(() => selectedIds
    .map((id) => models.find((model) => model.id === id))
    .filter(Boolean), [models, selectedIds]);
  const estimates = useMemo(() => selectedModels.map((model) => (
    estimateModel(model, values, currency)
  )), [selectedModels, values, currency]);
  const baseline = estimates.find((estimate) => estimate?.model.id === values.baselineModelId);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(values));
  }, [values]);

  const changeNumber = (field, maximum) => (value) => {
    setValues((current) => ({ ...current, [field]: clamp(value, maximum) }));
  };

  const shareEstimate = async () => {
    const shared = await onShare?.(values);
    setShareMessage(shared ? "估算链接已复制" : "无法复制估算链接");
  };

  return (
    <main className="calculator-view" aria-labelledby="calculator-title">
      <section className="calculator-intro">
        <p>按实际业务用量估算</p>
        <h2 id="calculator-title">成本估算</h2>
        <span>仅使用当前已选模型与公开价格；调用量保存在本地。</span>
      </section>

      <section className="estimator-panel" aria-label="估算参数">
        <div className="estimator-fields">
          <NumberField label="每月请求数" value={values.monthlyRequests} onChange={changeNumber("monthlyRequests")} />
          <NumberField label="平均输入 Token" value={values.averageInputTokens} onChange={changeNumber("averageInputTokens")} />
          <NumberField label="平均输出 Token" value={values.averageOutputTokens} onChange={changeNumber("averageOutputTokens")} />
          <NumberField label="缓存命中率" value={values.cacheHitRatePercent} maximum={100} onChange={changeNumber("cacheHitRatePercent", 100)} />
          <NumberField label="Batch 请求占比" value={values.batchSharePercent} maximum={100} onChange={changeNumber("batchSharePercent", 100)} />
          <label className="estimator-field">
            <span>基准模型</span>
            <select value={values.baselineModelId} onChange={(event) => setValues((current) => ({ ...current, baselineModelId: event.target.value }))}>
              <option value="">不设置基准</option>
              {selectedModels.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}
            </select>
          </label>
        </div>
        <div className="estimator-share">
          <button type="button" onClick={shareEstimate}>分享估算</button>
          <span>链接将包含当前调用量参数</span>
          {shareMessage ? <span role="status">{shareMessage}</span> : null}
        </div>
      </section>

      <section className="estimator-results" aria-label="成本估算结果">
        {selectedModels.length === 0 ? <p className="estimator-empty">先在价格对比中选择模型，再进行成本估算。</p> : null}
        {estimates.map((estimate, index) => {
          const model = selectedModels[index];
          if (!estimate) {
            return <article className="estimator-result is-unavailable" key={model.id} aria-label={`${model.displayName} 成本估算`}><h3>{model.displayName}</h3><p>无法估算</p></article>;
          }
          const difference = baseline && baseline.model.id !== model.id ? estimate.cost.total - baseline.cost.total : null;
          const differencePercent = difference !== null && baseline.cost.total > 0 ? difference / baseline.cost.total * 100 : null;
          return (
            <article className="estimator-result" key={model.id} aria-label={`${model.displayName} 成本估算`}>
              <div><p>{model.providerName ?? ""}</p><h3>{model.displayName}</h3></div>
              <dl>
                <div><dt>普通输入</dt><dd>{formatMoney(estimate.cost.normalInput, currency)}</dd></div>
                <div><dt>缓存输入</dt><dd>{formatMoney(estimate.cost.cachedInput, currency)}</dd></div>
                <div><dt>Batch</dt><dd>{formatMoney(estimate.cost.batchInput, currency)}</dd></div>
                <div><dt>输出</dt><dd>{formatMoney(estimate.cost.output, currency)}</dd></div>
              </dl>
              {!estimate.supportsCache && values.cacheHitRatePercent > 0 ? <p className="estimator-note">按标准输入价计算</p> : null}
              {!estimate.supportsBatch && values.batchSharePercent > 0 ? <p className="estimator-note">Batch 按标准价格计算</p> : null}
              <div className="estimator-total"><span>总成本</span><strong>{formatMoney(estimate.cost.total, currency)}</strong></div>
              {difference !== null ? <p className="estimator-difference">相对基准 {difference >= 0 ? "+" : ""}{formatMoney(difference, currency)}{differencePercent !== null ? `（${differencePercent >= 0 ? "+" : ""}${differencePercent.toFixed(2)}%）` : ""}</p> : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
