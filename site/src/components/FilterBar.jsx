import { useEffect, useState } from "react";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal.mjs";

const capabilityOptions = [
  { id: "text", label: "文本" },
  { id: "vision", label: "多模态" },
];

function toggle(list, value) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function FilterBar({ state, providers, onChange, onClear }) {
  const [query, setQuery] = useState(state.query);

  useEffect(() => {
    setQuery(state.query);
  }, [state.query]);

  useEffect(() => {
    if (query === state.query) return undefined;
    const timeout = window.setTimeout(() => onChange({ query }), 150);
    return () => window.clearTimeout(timeout);
  }, [onChange, query, state.query]);

  return (
    <section className="filter-bar" aria-label="模型筛选">
      <label className="search-field">
        <span className="visible-label">搜索模型或提供商</span>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="搜索模型 / 提供商"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <fieldset className="filter-group provider-filter">
        <legend>服务商</legend>
        <div className="segmented-options">
          <button
            className={state.providers.length === 0 ? "is-active" : ""}
            type="button"
            onClick={() => onChange({ providers: [] })}
          >
            全部
          </button>
          {providers.map((provider) => (
            <label className="segment-option" key={provider.id}>
              <input
                type="checkbox"
                checked={state.providers.includes(provider.id)}
                onChange={() => onChange({ providers: toggle(state.providers, provider.id) })}
              />
              <span>{provider.name.replace("开放平台", "")}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <span className="filter-divider" aria-hidden="true" />

      <fieldset className="filter-group capability-filter">
        <legend>模型类型</legend>
        <div className="segmented-options">
          <button
            className={state.capabilities.length === 0 ? "is-active" : ""}
            type="button"
            onClick={() => onChange({ capabilities: [] })}
          >
            全部
          </button>
          {capabilityOptions.map((option) => (
            <label className="segment-option" key={option.id}>
              <input
                type="checkbox"
                checked={state.capabilities.includes(option.id)}
                onChange={() => onChange({
                  capabilities: toggle(state.capabilities, option.id),
                })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <details className="more-filters">
        <summary>
          <SlidersHorizontal size={16} aria-hidden="true" />
          更多筛选
        </summary>
        <div className="more-filters-panel">
          <label>
            <span>最低上下文窗口</span>
            <select
              value={state.minContext}
              onChange={(event) => onChange({ minContext: Number(event.target.value) })}
            >
              <option value="0">不限</option>
              <option value="128000">128K</option>
              <option value="200000">200K</option>
              <option value="1000000">1,000K</option>
            </select>
          </label>
          <label className="check-filter">
            <input
              type="checkbox"
              checked={state.hasCache}
              onChange={(event) => onChange({ hasCache: event.target.checked })}
            />
            支持缓存价
          </label>
          <label className="check-filter">
            <input
              type="checkbox"
              checked={state.hasBatch}
              onChange={(event) => onChange({ hasBatch: event.target.checked })}
            />
            支持 Batch
          </label>
        </div>
      </details>

      <button className="clear-filters" type="button" onClick={onClear}>
        <RotateCcw size={15} aria-hidden="true" />
        清除筛选
      </button>
    </section>
  );
}
