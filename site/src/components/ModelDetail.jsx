import { useEffect, useRef } from "react";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";
import { exchangeRates } from "../data/exchangeRates.js";

function isPrice(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatPrice(value, currency) {
  if (!isPrice(value)) return "未公开";
  const symbol = currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toFixed(value < 0.1 ? 3 : 2)} ${currency} / 每百万 Token`;
}

function convert(value, sourceCurrency, targetCurrency) {
  if (!isPrice(value) || sourceCurrency === targetCurrency) return value;
  const rate = exchangeRates.find((item) => item.baseCurrency === "USD" && item.quoteCurrency === "CNY")?.rate;
  if (!rate) return undefined;
  return sourceCurrency === "USD" ? value * rate : value / rate;
}

function PriceRows({ price, currency }) {
  const rows = [
    ["标准输入", price.input],
    ["标准输出", price.output],
    ["缓存输入", price.cachedInput],
    ["缓存写入", price.cacheWrite],
    ["Batch 输入", price.batchInput],
    ["Batch 输出", price.batchOutput],
  ].filter(([, value]) => isPrice(value));

  return (
    <dl className="detail-prices">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <span>{formatPrice(value, price.currency)}</span>
            {price.currency !== currency ? <small>折合 {formatPrice(convert(value, price.currency, currency), currency)}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Tiers({ tiers, currency }) {
  if (!tiers?.length) return null;
  return (
    <section className="detail-tiers" aria-label="阶梯价格">
      <h3>阶梯价格</h3>
      <ul>
        {tiers.map((tier, index) => (
          <li key={`${tier.minInputTokens}-${tier.maxInputTokens}`}>
            <strong>第 {index + 1} 档：{tier.minInputTokens.toLocaleString("zh-CN")}–{tier.maxInputTokens.toLocaleString("zh-CN")} Token</strong>
            <span>输入 {formatPrice(tier.input, currency)}；输出 {formatPrice(tier.output, currency)}</span>
            {isPrice(tier.batchInput) || isPrice(tier.batchOutput)
              ? <span>Batch：输入 {formatPrice(tier.batchInput, currency)}；输出 {formatPrice(tier.batchOutput, currency)}</span>
              : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ModelDetail({ model, currency, onClose, onAddToComparison }) {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [...dialogRef.current.querySelectorAll("button:not([disabled]), a[href]")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <section ref={dialogRef} className="model-detail" role="dialog" aria-modal="true" aria-labelledby="model-detail-title">
      <header className="model-detail-header">
        <div>
          <p>{model.providerName} · {model.status === "retired" ? "已下线" : "在售"}</p>
          <h2 id="model-detail-title">{model.displayName} 详情</h2>
          <code>{model.apiModelId}</code>
        </div>
        <button ref={closeButtonRef} type="button" aria-label="关闭详情" onClick={onClose}>关闭</button>
      </header>

      <div className="model-detail-meta">
        <span>上下文窗口 {Math.round(model.contextWindow / 1000).toLocaleString("zh-CN")}K</span>
        <span>能力：{model.capabilities.join("、")}</span>
      </div>

      <div className="detail-version-list">
        {model.pricing.map((price) => (
          <article className="detail-version" key={`${price.effectiveAt}-${price.verifiedAt}`}>
            <div className="detail-version-heading">
              <div>
                <h3>价格版本 {price.effectiveAt}</h3>
                <p>核验日期：{price.verifiedAt}</p>
              </div>
              <a href={price.sourceUrl} target="_blank" rel="noreferrer">
                官方来源 <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
            <PriceRows price={price} currency={currency} />
            <Tiers tiers={price.tiers} currency={price.currency} />
            <section className="detail-conditions" aria-label="计费条件">
              <h3>计费条件</h3>
              <ul>{price.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
            </section>
          </article>
        ))}
      </div>

      <footer className="model-detail-footer">
        {model.status === "retired"
          ? <p>已下线模型仅保留历史详情，不能加入新的对比。</p>
          : <button type="button" onClick={onAddToComparison}>加入对比</button>}
      </footer>
    </section>
  );
}
