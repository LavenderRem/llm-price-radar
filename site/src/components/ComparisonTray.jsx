function formatPrice(value, currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "未公开";
  const symbol = currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toFixed(value < 0.1 ? 3 : 2)}`;
}

export function ComparisonTray({ models, selectedIds, onRemove, onOpenComparison }) {
  const modelById = new Map(models.map((model) => [model.id, model]));
  const selectedModels = selectedIds.map((id) => modelById.get(id)).filter(Boolean);

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
          <p className="comparison-cost-summary">在成本估算中查看月成本摘要</p>
          <button className="comparison-open" type="button" onClick={onOpenComparison}>
            查看对比详情
          </button>
        </>
      )}
    </section>
  );
}
