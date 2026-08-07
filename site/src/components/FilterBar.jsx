import { useEffect, useRef, useState } from "react";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { ProviderLogo } from "./ProviderLogo.jsx";

const capabilityOptions = [
  { id: "text", label: "文本" },
  { id: "vision", label: "多模态" },
  { id: "reasoning", label: "推理" },
  { id: "embedding", label: "Embedding" },
];

function toggle(list, value) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function FilterBar({ state, providers, onChange, onClear }) {
  const [query, setQuery] = useState(state.query);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTriggerRef = useRef(null);
  const filterDrawerRef = useRef(null);
  const filterCloseRef = useRef(null);

  useEffect(() => {
    setQuery(state.query);
  }, [state.query]);

  useEffect(() => {
    if (query === state.query) return undefined;
    const timeout = window.setTimeout(() => onChange({ query }, { history: "replace" }), 150);
    return () => window.clearTimeout(timeout);
  }, [onChange, query, state.query]);

  useEffect(() => {
    if (!filterOpen) return undefined;
    filterCloseRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFilterOpen(false);
        filterTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = filterDrawerRef.current
        ? [...filterDrawerRef.current.querySelectorAll(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, a[href]",
        )]
        : [];
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
  }, [filterOpen]);

  const closeFilters = () => {
    setFilterOpen(false);
    filterTriggerRef.current?.focus();
  };

  return (
    <section className="filter-bar" aria-label="模型筛选">
      <label className="search-field">
        <span className="visible-label">搜索模型或提供商</span>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="例如：GPT-5"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <button
        ref={filterTriggerRef}
        className="mobile-filter-trigger"
        type="button"
        aria-controls="filter-drawer"
        aria-expanded={filterOpen}
        onClick={() => setFilterOpen(true)}
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        打开筛选
      </button>

      <div
        ref={filterDrawerRef}
        id="filter-drawer"
        className={filterOpen ? "filter-drawer is-open" : "filter-drawer"}
        role={filterOpen ? "dialog" : undefined}
        aria-modal={filterOpen ? "true" : undefined}
        aria-labelledby={filterOpen ? "filter-drawer-title" : undefined}
      >
        <header className="filter-drawer-header">
          <div>
            <p>快速缩小模型范围</p>
            <h2 id="filter-drawer-title">筛选模型</h2>
          </div>
          <button ref={filterCloseRef} type="button" aria-label="关闭筛选" onClick={closeFilters}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="filter-group provider-filter" role="group" aria-labelledby="provider-filter-label">
          <span className="filter-group-label" id="provider-filter-label">服务商</span>
          <div className="provider-icon-options">
            <button
              className={state.providers.length === 0 ? "is-active" : ""}
              type="button"
              aria-label="全部服务商"
              aria-pressed={state.providers.length === 0}
              onClick={() => onChange({ providers: [] })}
            >
              全部
            </button>
            {providers.map((provider) => (
              <label className="provider-icon-option" key={provider.id} title={provider.name}>
                <input
                  type="checkbox"
                  checked={state.providers.includes(provider.id)}
                  onChange={() => onChange({ providers: toggle(state.providers, provider.id) })}
                />
                <ProviderLogo providerId={provider.id} />
                <span className="sr-only">{provider.name}</span>
              </label>
            ))}
          </div>
        </div>

        <span className="filter-divider" aria-hidden="true" />

        <div className="filter-group capability-filter" role="group" aria-labelledby="capability-filter-label">
          <span className="filter-group-label" id="capability-filter-label">模型类型</span>
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
        </div>

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
            <label>
              <span>最低输入价</span>
              <input
                aria-label="最低输入价"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={state.minInputPrice || ""}
                placeholder={`0 ${state.currency}/百万 Token`}
                onChange={(event) => onChange({ minInputPrice: Number(event.target.value) || 0 })}
              />
            </label>
            <label>
              <span>最高输入价</span>
              <input
                aria-label="最高输入价"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={state.maxInputPrice || ""}
                placeholder={`不限（${state.currency}/百万 Token）`}
                onChange={(event) => onChange({ maxInputPrice: Number(event.target.value) || 0 })}
              />
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
        <button className="filter-drawer-done" type="button" onClick={closeFilters}>查看结果</button>
      </div>
    </section>
  );
}
