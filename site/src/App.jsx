import { useState } from "react";
import Info from "lucide-react/dist/esm/icons/info.mjs";
import { AppHeader } from "./components/AppHeader.jsx";
import { ComparisonTray } from "./components/ComparisonTray.jsx";
import { ComparisonView } from "./components/ComparisonView.jsx";
import { EmptyState } from "./components/EmptyState.jsx";
import { FilterBar } from "./components/FilterBar.jsx";
import { PricingTable } from "./components/PricingTable.jsx";
import { models, providers } from "./data/catalog.js";
import { exchangeRates } from "./data/exchangeRates.js";
import { toggleComparison } from "./domain/comparison.js";
import { filterAndSortModels } from "./domain/filters.js";
import { normalizeModel } from "./domain/pricing.js";
import { parseUrlState, serializeUrlState } from "./domain/urlState.js";
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
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonLimitReached, setComparisonLimitReached] = useState(false);
  const [state, setState] = useUrlState(parseUrlState(window.location.search));
  const normalizedModels = models.map((model) => normalizeModel(model, state.currency, exchangeRates, providers));
  const visibleModels = filterAndSortModels(normalizedModels, state);
  const verifiedAt = models[0]?.pricing[0]?.verifiedAt ?? "";

  const changeFilters = (changes) => {
    setState((current) => ({ ...current, ...changes }));
  };

  const toggleCompare = (modelId) => {
    setState((current) => {
      const result = toggleComparison(current.compareIds, modelId);
      setComparisonLimitReached(result.limitReached);
      return { ...current, compareIds: result.ids };
    });
  };

  const removeFromComparison = (modelId) => {
    setState((current) => ({
      ...current,
      compareIds: current.compareIds.filter((id) => id !== modelId),
    }));
    setComparisonLimitReached(false);
  };

  const copyComparisonLink = async () => {
    if (!navigator.clipboard?.writeText) return false;
    const url = `${window.location.origin}${window.location.pathname}${serializeUrlState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };

  const selectedModels = state.compareIds
    .map((id) => normalizedModels.find((model) => model.id === id))
    .filter(Boolean);

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
            <button className="compare-cta" type="button" onClick={() => setComparisonOpen(true)}>
              加入对比（{state.compareIds.length}）
            </button>
            {comparisonLimitReached ? <p className="comparison-limit" role="status">最多选择 3 个模型</p> : null}
            <ComparisonTray
              models={normalizedModels}
              selectedIds={state.compareIds}
              onRemove={removeFromComparison}
              onOpenComparison={() => setComparisonOpen(true)}
            />
          </aside>
        </main>
      ) : (
        <main className="future-view-slot">
          <p>{view === "calculator" ? "成本估算" : "更新记录"}</p>
        </main>
      )}
      {comparisonOpen ? (
        <div className="comparison-overlay">
          <ComparisonView
            models={selectedModels}
            currency={state.currency}
            onClose={() => setComparisonOpen(false)}
            onRemove={removeFromComparison}
            onCopyLink={copyComparisonLink}
          />
        </div>
      ) : null}
    </div>
  );
}
