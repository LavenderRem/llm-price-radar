import { useState } from "react";
import Info from "lucide-react/dist/esm/icons/info.mjs";
import { AppHeader } from "./components/AppHeader.jsx";
import { EmptyState } from "./components/EmptyState.jsx";
import { FilterBar } from "./components/FilterBar.jsx";
import { PricingTable } from "./components/PricingTable.jsx";
import { models, providers } from "./data/catalog.js";
import { exchangeRates } from "./data/exchangeRates.js";
import { filterAndSortModels } from "./domain/filters.js";
import { normalizeModel } from "./domain/pricing.js";
import { parseUrlState } from "./domain/urlState.js";
import { useUrlState } from "./hooks/useUrlState.js";

const filterDefaults = {
  query: "",
  providers: [],
  capabilities: [],
  minContext: 0,
  hasCache: false,
  hasBatch: false,
};

export function App() {
  const [view, setView] = useState("pricing");
  const [state, setState] = useUrlState(parseUrlState(window.location.search));
  const normalizedModels = models.map((model) => normalizeModel(model, state.currency, exchangeRates, providers));
  const visibleModels = filterAndSortModels(normalizedModels, state);
  const verifiedAt = models[0]?.pricing[0]?.verifiedAt ?? "";

  const changeFilters = (changes) => {
    setState((current) => ({ ...current, ...changes }));
  };

  const toggleCompare = (modelId) => {
    setState((current) => {
      const selected = current.compareIds.includes(modelId);
      const compareIds = selected
        ? current.compareIds.filter((id) => id !== modelId)
        : [...current.compareIds, modelId].slice(0, 3);
      return { ...current, compareIds };
    });
  };

  const changeSort = (sortBy) => {
    setState((current) => ({
      ...current,
      sortBy,
      sortDirection: current.sortBy === sortBy && current.sortDirection === "asc" ? "desc" : "asc",
    }));
  };

  const clearFilters = () => {
    setState((current) => ({ ...current, ...filterDefaults }));
  };

  return (
    <div className="app-shell">
      <AppHeader
        view={view}
        currency={state.currency}
        verifiedAt={verifiedAt}
        onViewChange={setView}
        onCurrencyChange={(currency) => changeFilters({ currency })}
      />

      {view === "pricing" ? (
        <main className="catalog-layout">
          <section className="catalog-main" aria-label="模型价格目录">
            <FilterBar
              state={state}
              providers={providers}
              onChange={changeFilters}
              onClear={clearFilters}
            />
            <p className="pricing-note">
              统一按每百万 Token 折算
              <Info size={14} aria-label="价格均统一折算为每百万 Token" />
            </p>
            {visibleModels.length > 0 ? (
              <PricingTable
                models={visibleModels}
                currency={state.currency}
                selectedIds={state.compareIds}
                onToggleCompare={toggleCompare}
                onOpenDetail={(detailId) => changeFilters({ detailId })}
                sortBy={state.sortBy}
                sortDirection={state.sortDirection}
                onSort={changeSort}
              />
            ) : (
              <EmptyState onClear={clearFilters} />
            )}
          </section>

          <aside className="comparison-slot" aria-label="对比区域">
            <button className="compare-cta" type="button">
              加入对比（{state.compareIds.length}）
            </button>
            <div className="comparison-placeholder">
              <strong>对比清单</strong>
              <span>{state.compareIds.length}/3</span>
              <p>选择模型后将在这里展示对比清单。</p>
            </div>
          </aside>
        </main>
      ) : (
        <main className="future-view-slot">
          <p>{view === "calculator" ? "成本估算" : "更新记录"}</p>
        </main>
      )}
    </div>
  );
}
