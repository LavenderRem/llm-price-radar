import { useEffect, useRef, useState } from "react";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";

function formatPrice(value, currency) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "未公开";
  const symbol = currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toFixed(value < 0.1 ? 3 : 2)} ${currency} / 每百万 Token`;
}

function formatContext(value) {
  return `${Math.round(value / 1000).toLocaleString("zh-CN")}K`;
}

function PriceCell({ value, minValue, currency }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return <span>未公开</span>;
  const lowest = value === minValue;
  return (
    <span className={lowest ? "comparison-price is-lowest" : "comparison-price"}>
      {formatPrice(value, currency)}
      {lowest ? <small>当前最低价</small> : null}
    </span>
  );
}

function minimum(models, key) {
  const values = models.map((model) => model.normalized[key]).filter((value) => typeof value === "number");
  return values.length ? Math.min(...values) : undefined;
}

function ComparisonRow({ label, models, children }) {
  return (
    <div className="comparison-row">
      <dt>{label}</dt>
      {models.map((model) => <dd key={model.id}>{children(model)}</dd>)}
    </div>
  );
}

export function ComparisonView({ models, currency, onClose, onRemove, onCopyLink }) {
  const [copyMessage, setCopyMessage] = useState("");
  const closeButtonRef = useRef(null);
  const minInput = minimum(models, "input");
  const minOutput = minimum(models, "output");
  const minCached = minimum(models, "cachedInput");

  const copyLink = async () => {
    const copied = await onCopyLink();
    setCopyMessage(copied ? "链接已复制" : "无法复制链接");
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <section
      className="comparison-view"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-title"
      style={{ "--comparison-columns": models.length }}
    >
      <div className="comparison-view-header">
        <div>
          <p>最多 3 个模型</p>
          <h2 id="comparison-title">模型对比</h2>
        </div>
        <button ref={closeButtonRef} type="button" aria-label="关闭对比" onClick={onClose}>关闭</button>
      </div>
      <div className="comparison-model-headings">
        <span aria-hidden="true" />
        {models.map((model) => (
          <div key={model.id}>
            <strong>{model.displayName}</strong>
            <span>{model.providerName}</span>
            <button type="button" aria-label={`移除 ${model.displayName}`} onClick={() => onRemove(model.id)}>移除</button>
          </div>
        ))}
      </div>
      <dl className="comparison-grid">
        <ComparisonRow label="标准输入" models={models}>
          {(model) => <PriceCell value={model.normalized.input} minValue={minInput} currency={currency} />}
        </ComparisonRow>
        <ComparisonRow label="标准输出" models={models}>
          {(model) => <PriceCell value={model.normalized.output} minValue={minOutput} currency={currency} />}
        </ComparisonRow>
        <ComparisonRow label="缓存输入" models={models}>
          {(model) => <PriceCell value={model.normalized.cachedInput} minValue={minCached} currency={currency} />}
        </ComparisonRow>
        <ComparisonRow label="Batch 输入 / 输出" models={models}>
          {(model) => <span>{formatPrice(model.normalized.batchInput, currency)} / {formatPrice(model.normalized.batchOutput, currency)}</span>}
        </ComparisonRow>
        <ComparisonRow label="上下文窗口" models={models}>
          {(model) => formatContext(model.contextWindow)}
        </ComparisonRow>
        <ComparisonRow label="能力" models={models}>
          {(model) => model.capabilities.join("、")}
        </ComparisonRow>
        <ComparisonRow label="计费条件" models={models}>
          {(model) => <span>{model.pricing[0].conditions.join("；")}</span>}
        </ComparisonRow>
        <ComparisonRow label="核验日期" models={models}>
          {(model) => model.pricing[0].verifiedAt}
        </ComparisonRow>
        <ComparisonRow label="官方来源" models={models}>
          {(model) => <a href={model.pricing[0].sourceUrl} target="_blank" rel="noreferrer">查看官方价格 <ExternalLink size={13} aria-hidden="true" /></a>}
        </ComparisonRow>
      </dl>
      <footer className="comparison-view-footer">
        <button className="comparison-copy" type="button" onClick={copyLink}>复制对比链接</button>
        {copyMessage ? <span role="status">{copyMessage}</span> : null}
      </footer>
    </section>
  );
}
