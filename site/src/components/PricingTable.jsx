import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up.mjs";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";

const capabilityLabels = {
  text: "文本",
  vision: "多模态",
  audio: "音频",
  video: "视频",
};

const providerMarks = {
  openai: "O",
  anthropic: "A",
  google: "G",
  deepseek: "D",
  aliyun: "百",
  zhipu: "智",
};

function isPrice(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatContext(value) {
  return `${Math.round(value / 1000).toLocaleString("zh-CN")}K`;
}

function formatPrice(value) {
  if (!isPrice(value)) return null;
  if (value === 0) return "0.00";
  if (value < 0.1) return value.toFixed(3);
  return value.toFixed(2);
}

function Price({ value, currency, accent = false, barMax = 0 }) {
  if (!isPrice(value)) return <span className="unpublished">未公开</span>;

  const symbol = currency === "CNY" ? "¥" : "$";
  return (
    <span className={`price-value${accent ? " price-value-accent" : ""}`}>
      <strong>{symbol}{formatPrice(value)}</strong>
      <small>{currency} · 每百万 Token</small>
      {barMax > 0 ? (
        <progress aria-label={`${formatPrice(value)} ${currency}`} max={barMax} value={value} />
      ) : null}
    </span>
  );
}

function SortButton({ field, label, sortBy, sortDirection, onSort }) {
  const active = sortBy === field;
  const ariaSort = active
    ? (sortDirection === "asc" ? "ascending" : "descending")
    : "none";
  return (
    <button
      className={active ? "sort-button is-active" : "sort-button"}
      type="button"
      aria-sort={ariaSort}
      aria-label={`${label}${active ? (sortDirection === "asc" ? "，升序" : "，降序") : ""}`}
      onClick={() => onSort(field)}
    >
      <span>{label}</span>
      {active && sortDirection === "desc"
        ? <ChevronDown size={13} aria-hidden="true" />
        : <ChevronUp size={13} aria-hidden="true" />}
    </button>
  );
}

function CapabilityTags({ capabilities }) {
  const visibleCapabilities = capabilities.includes("vision")
    ? ["text", "vision"]
    : capabilities.slice(0, 2);
  return (
    <span className="capability-tags">
      {visibleCapabilities.map((capability) => (
        <span className={`capability-tag capability-${capability}`} key={capability}>
          {capabilityLabels[capability] ?? capability}
        </span>
      ))}
    </span>
  );
}

function batchDiscount(normalized) {
  if (!isPrice(normalized.batchInput) || !isPrice(normalized.batchOutput)) return null;
  const input = Math.round((1 - normalized.batchInput / normalized.input) * 100);
  const output = Math.round((1 - normalized.batchOutput / normalized.output) * 100);
  return `${input}% / ${output}%`;
}

function PricePair({ normalized, currency }) {
  const input = isPrice(normalized.batchInput) ? normalized.batchInput : normalized.input;
  const output = isPrice(normalized.batchOutput) ? normalized.batchOutput : normalized.output;
  if (!isPrice(input) || !isPrice(output)) return <span className="unpublished">未公开</span>;

  const symbol = currency === "CNY" ? "¥" : "$";
  return (
    <span className={isPrice(normalized.batchInput) ? "effective-pair has-discount" : "effective-pair"}>
      {symbol}{formatPrice(input)} / {symbol}{formatPrice(output)}
      <small>{currency} · 每百万 Token</small>
    </span>
  );
}

function ModelIdentity({ model, onOpenDetail }) {
  return (
    <span className="model-identity">
      <span className={`provider-mark provider-${model.providerId}`} aria-hidden="true">
        {providerMarks[model.providerId] ?? model.providerName.slice(0, 1)}
      </span>
      <span>
        <strong>{model.providerName}</strong>
        <button
          className="model-detail-button"
          type="button"
          aria-label={`查看 ${model.displayName} 详情`}
          onClick={() => onOpenDetail(model.id)}
        >
          {model.displayName}
        </button>
      </span>
    </span>
  );
}

export function PricingTable({
  models,
  currency,
  selectedIds,
  onToggleCompare,
  onOpenDetail,
  sortBy,
  sortDirection,
  onSort,
}) {
  const maxInput = Math.max(0, ...models.map((model) => model.normalized.input ?? 0));
  const maxOutput = Math.max(0, ...models.map((model) => model.normalized.output ?? 0));
  const maxCached = Math.max(0, ...models.map((model) => model.normalized.cachedInput ?? 0));

  return (
    <>
      <div className="pricing-table-shell">
        <table className="pricing-table">
          <colgroup>
            <col className="select-column" />
            <col className="model-column" />
            <col className="capability-column" />
            <col className="context-column" />
            <col className="price-column" />
            <col className="price-column" />
            <col className="price-column cached-column" />
            <col className="discount-column" />
            <col className="effective-column" />
            <col className="source-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">加入对比</span></th>
              <th scope="col">提供商 / 模型</th>
              <th scope="col">能力标签</th>
              <th scope="col">上下文窗口</th>
              <th scope="col" aria-sort={sortBy === "input" ? `${sortDirection}ending` : "none"}>
                <SortButton field="input" label="输入价格" {...{ sortBy, sortDirection, onSort }} />
                <span className="column-unit">每百万 Token</span>
              </th>
              <th scope="col" aria-sort={sortBy === "output" ? `${sortDirection}ending` : "none"}>
                <SortButton field="output" label="输出价格" {...{ sortBy, sortDirection, onSort }} />
                <span className="column-unit">每百万 Token</span>
              </th>
              <th scope="col">缓存输入<span className="column-unit">每百万 Token</span></th>
              <th scope="col">批量折扣<span className="column-unit">输入 / 输出</span></th>
              <th scope="col" aria-sort={sortBy === "blended" ? `${sortDirection}ending` : "none"}>
                <SortButton field="blended" label="有效价格" {...{ sortBy, sortDirection, onSort }} />
                <span className="column-unit">输入 / 输出</span>
              </th>
              <th scope="col">官方来源</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => {
              const selected = selectedIds.includes(model.id);
              const discount = batchDiscount(model.normalized);
              return (
                <tr className={selected ? "is-selected" : ""} key={model.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`选择 ${model.displayName} 加入对比`}
                      checked={selected}
                      onChange={() => onToggleCompare(model.id)}
                    />
                  </td>
                  <td><ModelIdentity model={model} onOpenDetail={onOpenDetail} /></td>
                  <td><CapabilityTags capabilities={model.capabilities} /></td>
                  <td className="context-value">{formatContext(model.contextWindow)}</td>
                  <td><Price value={model.normalized.input} currency={currency} barMax={maxInput} /></td>
                  <td><Price value={model.normalized.output} currency={currency} barMax={maxOutput} /></td>
                  <td><Price value={model.normalized.cachedInput} currency={currency} accent barMax={maxCached} /></td>
                  <td>{discount ? <span className="discount-value">{discount}</span> : <span className="unpublished">未公开</span>}</td>
                  <td><PricePair normalized={model.normalized} currency={currency} /></td>
                  <td>
                    <a className="source-link" href={model.pricing[0].sourceUrl} target="_blank" rel="noreferrer">
                      查看官方价
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <footer className="table-footer">共 {models.length} 个模型</footer>
      </div>

      <ul className="mobile-model-list" aria-label="模型价格摘要">
        {models.map((model) => {
          const selected = selectedIds.includes(model.id);
          return (
            <li key={model.id}>
              <div className="mobile-model-heading">
                <ModelIdentity model={model} onOpenDetail={onOpenDetail} />
                <button
                  className="mobile-compare-toggle"
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleCompare(model.id)}
                >
                  {selected ? "已选择" : "加入对比"}
                </button>
              </div>
              <CapabilityTags capabilities={model.capabilities} />
              <dl>
                <div><dt>输入价格</dt><dd><Price value={model.normalized.input} currency={currency} /></dd></div>
                <div><dt>输出价格</dt><dd><Price value={model.normalized.output} currency={currency} /></dd></div>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}
