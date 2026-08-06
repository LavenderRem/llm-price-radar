import { useEffect, useRef } from "react";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";
import { exchangeRates } from "../data/exchangeRates.js";
import { normalizePricing } from "../domain/pricing.js";

function isPrice(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatPrice(value, currency) {
  if (!isPrice(value)) return "未公开";
  const symbol = currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toFixed(value < 0.1 ? 3 : 2)} ${currency} / 每百万 Token`;
}

function PriceRows({ price, currency }) {
  const rows = [
    ["标准输入", "input", price.input],
    ["标准输出", "output", price.output],
    ["缓存输入", "cachedInput", price.cachedInput],
    ["缓存写入", "cacheWrite", price.cacheWrite],
    ["Batch 输入", "batchInput", price.batchInput],
    ["Batch 缓存输入", "batchCachedInput", price.batchCachedInput],
    ["Batch 输出", "batchOutput", price.batchOutput],
  ].filter(([, , value]) => isPrice(value));

  const normalized = price.currency === currency ? null : normalizePricing(price, currency, exchangeRates);

  return (
    <dl className="detail-prices">
      {rows.map(([label, key, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <span>{formatPrice(value, price.currency)}</span>
            {normalized ? <small>折合 {formatPrice(normalized[key], currency)}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Tiers({ price, currency }) {
  const { tiers } = price;
  if (!tiers?.length) return null;
  return (
    <section className="detail-tiers" aria-label="阶梯价格">
      <h3>阶梯价格</h3>
      <ul>
        {tiers.map((tier, index) => {
          const normalizedTier = price.currency === currency
            ? null
            : normalizePricing({ ...price, ...tier }, currency, exchangeRates);
          return (
            <li key={`${tier.minInputTokens}-${tier.maxInputTokens}`}>
              <strong>第 {index + 1} 档：{tier.minInputTokens.toLocaleString("zh-CN")}–{tier.maxInputTokens.toLocaleString("zh-CN")} Token</strong>
              <span>输入 {formatPrice(tier.input, price.currency)}；输出 {formatPrice(tier.output, price.currency)}</span>
              {isPrice(tier.cachedInput) || isPrice(tier.cacheWrite)
                ? <span>缓存输入 {formatPrice(tier.cachedInput, price.currency)}；缓存写入 {formatPrice(tier.cacheWrite, price.currency)}</span>
                : null}
              {normalizedTier ? <span>折合：输入 {formatPrice(normalizedTier.input, currency)}；输出 {formatPrice(normalizedTier.output, currency)}</span> : null}
              {isPrice(tier.batchInput) || isPrice(tier.batchOutput)
                ? <>
                  <span>
                    Batch：输入 {formatPrice(tier.batchInput, price.currency)}
                    {isPrice(tier.batchCachedInput) ? <>；缓存输入 {formatPrice(tier.batchCachedInput, price.currency)}</> : null}
                    ；输出 {formatPrice(tier.batchOutput, price.currency)}
                  </span>
                  {normalizedTier ? <span>
                    折合 Batch：输入 {formatPrice(normalizedTier.batchInput, currency)}
                    {isPrice(tier.batchCachedInput) ? <>；缓存输入 {formatPrice(normalizedTier.batchCachedInput, currency)}</> : null}
                    ；输出 {formatPrice(normalizedTier.batchOutput, currency)}
                  </span> : null}
                </>
                : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ModelDetail({
  model,
  currency,
  onClose,
  onAddToComparison,
  isSelected = false,
  comparisonLimitReached = false,
}) {
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
            <Tiers price={price} currency={currency} />
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
          : <>
            {comparisonLimitReached ? <p className="comparison-limit" role="status">最多选择 3 个模型</p> : null}
            <button type="button" aria-pressed={isSelected} onClick={onAddToComparison}>
              {isSelected ? "移出对比" : "加入对比"}
            </button>
          </>}
      </footer>
    </section>
  );
}
