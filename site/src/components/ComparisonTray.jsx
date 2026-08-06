import { calculateMonthlyCost } from "../domain/cost.js";
import { ProviderLogo } from "./ProviderLogo.jsx";

const referenceUsage = {
  monthlyRequests: 1,
  averageInputTokens: 10000000,
  averageOutputTokens: 5000000,
  cacheHitRate: 0,
  batchShare: 0,
};

function formatPrice(value, currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "未公开";
  const symbol = currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toFixed(value < 0.1 ? 3 : 2)}`;
}

function monthlyCost(model) {
  const price = model.normalized;
  if (!Number.isFinite(price?.input) || !Number.isFinite(price?.output)) return null;

  try {
    return calculateMonthlyCost({ ...price, unitTokens: price.unitTokens ?? 1000000 }, referenceUsage).total;
  } catch {
    return null;
  }
}

function formatMonthlyCost(value, currency) {
  if (!Number.isFinite(value)) return "无法估算";
  const symbol = currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ComparisonTray({ models, selectedIds, onRemove, onOpenComparison, onOpenCost }) {
  const modelById = new Map(models.map((model) => [model.id, model]));
  const selectedModels = selectedIds.map((id) => modelById.get(id)).filter(Boolean);
  const estimates = selectedModels.map((model) => ({ model, total: monthlyCost(model) }));
  const availableTotals = estimates.map(({ total }) => total).filter(Number.isFinite);
  const lowestTotal = availableTotals.length > 0 ? Math.min(...availableTotals) : null;

  return (
    <section className="comparison-tray" aria-label="对比清单">
      <div className="comparison-tray-heading">
        <strong>对比清单</strong>
        <span>{selectedModels.length}/3</span>
      </div>
      {selectedModels.length === 0 ? (
        <p className="comparison-empty">最多选择 3 个模型进行对比</p>
      ) : (
        <>
          <ul className="comparison-selection-list">
            {selectedModels.map((model) => (
              <li key={model.id}>
                <ProviderLogo providerId={model.providerId} />
                <div>
                  <strong>{model.displayName}</strong>
                  <span>{model.providerName}</span>
                  <small>
                    输入 {formatPrice(model.normalized.input, model.normalized.currency)} ·
                    输出 {formatPrice(model.normalized.output, model.normalized.currency)}
                  </small>
                </div>
                <button type="button" aria-label={`移除 ${model.displayName}`} onClick={() => onRemove(model.id)}>
                  移除
                </button>
              </li>
            ))}
          </ul>
          <section className="comparison-monthly-summary" aria-label="参考月成本">
            <header>
              <strong>参考月成本</strong>
              <span>参考月用量：输入 10M / 输出 5M</span>
            </header>
            <ul>
              {estimates.map(({ model, total }) => (
                <li key={model.id}>
                  <span>{model.displayName}</span>
                  <strong>{formatMonthlyCost(total, model.normalized.currency)}</strong>
                  {total === lowestTotal ? <small>最低月成本</small> : null}
                </li>
              ))}
            </ul>
            <p>仅比较相同公开价格与参考用量，不代表模型能力排序。</p>
          </section>
          <button className="comparison-cost-summary" type="button" onClick={onOpenCost}>
            前往成本估算
          </button>
          <button className="comparison-open" type="button" onClick={onOpenComparison}>
            查看对比详情
          </button>
        </>
      )}
    </section>
  );
}
