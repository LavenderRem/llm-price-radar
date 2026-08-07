import { useCallback, useRef, useState } from "react";
import Info from "lucide-react/dist/esm/icons/info.mjs";
import { AppHeader } from "./components/AppHeader.jsx";
import { ComparisonTray } from "./components/ComparisonTray.jsx";
import { ComparisonView } from "./components/ComparisonView.jsx";
import { CostEstimator } from "./components/CostEstimator.jsx";
import { EmptyState } from "./components/EmptyState.jsx";
import { FilterBar } from "./components/FilterBar.jsx";
import { MethodologyView } from "./components/MethodologyView.jsx";
import { ModelDetail } from "./components/ModelDetail.jsx";
import { PricingTable } from "./components/PricingTable.jsx";
import { UpdatesView } from "./components/UpdatesView.jsx";
import { models, providers } from "./data/catalog.js";
import { exchangeRates } from "./data/exchangeRates.js";
import { updates } from "./data/updates.js";
import { sanitizeComparisonIds, toggleComparison } from "./domain/comparison.js";
import { filterAndSortModels } from "./domain/filters.js";
import { normalizeModel } from "./domain/pricing.js";
import { parseUrlState, serializeUrlState } from "./domain/urlState.js";
import { useUrlState } from "./hooks/useUrlState.js";

const filterDefaults = {
  query: "",
  providers: [],
  capabilities: [],
  minContext: 0,
  minInputPrice: 0,
  maxInputPrice: 0,
  hasCache: false,
  hasBatch: false,
};

function sanitizeUrlComparisonState(state) {
  const sanitized = sanitizeComparisonIds(state.compareIds, models);
  return {
    state: { ...state, compareIds: sanitized.ids },
    ...sanitized,
  };
}

function comparisonCleanupMessage({ invalidCount, overflowCount }) {
  const messages = [];
  if (invalidCount > 0) {
    messages.push(`链接中的 ${invalidCount} 个模型已不可用，已忽略`);
  }
  if (overflowCount > 0) {
    messages.push(`最多选择 3 个模型，已忽略 ${overflowCount} 个超额模型`);
  }
  return messages.join("；");
}

export function App() {
  const [view, setView] = useState("pricing");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonLimitReached, setComparisonLimitReached] = useState(false);
  const comparisonTriggerRef = useRef(null);
  const comparisonCtaRef = useRef(null);
  const detailTriggerRef = useRef(null);
  const importedEstimateRef = useRef(new URLSearchParams(window.location.search).get("estimate") ?? "");
  const initialStateRef = useRef(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = sanitizeUrlComparisonState(parseUrlState(window.location.search));
  }
  const [invalidCompareMessage, setInvalidCompareMessage] = useState(() => {
    return comparisonCleanupMessage(initialStateRef.current);
  });
  const restoreUrlState = useCallback((restored) => {
    const sanitized = sanitizeUrlComparisonState(restored);
    setInvalidCompareMessage(comparisonCleanupMessage(sanitized));
    return { state: sanitized.state, changed: sanitized.normalizedChanged };
  }, []);
  const [state, setState] = useUrlState(initialStateRef.current.state, restoreUrlState);
  const normalizedModels = models.map((model) => normalizeModel(model, state.currency, exchangeRates, providers));
  const visibleModels = filterAndSortModels(normalizedModels, state);
  const verifiedAt = models[0]?.pricing[0]?.verifiedAt ?? "";
  const detailModel = normalizedModels.find((model) => model.id === state.detailId);

  const changeFilters = (changes, options) => {
    setState((current) => ({ ...current, ...changes }), options);
  };

  const toggleCompare = (modelId) => {
    setState((current) => {
      const result = toggleComparison(current.compareIds, modelId);
      setComparisonLimitReached(result.limitReached);
      return { ...current, compareIds: result.ids };
    });
  };

  const removeFromComparison = (modelId) => {
    const removingLastModel = state.compareIds.length === 1 && state.compareIds[0] === modelId;
    setState((current) => ({
      ...current,
      compareIds: current.compareIds.filter((id) => id !== modelId),
    }));
    setComparisonLimitReached(false);
    if (removingLastModel) {
      setComparisonOpen(false);
      comparisonCtaRef.current?.focus();
    }
  };

  const openComparison = (event) => {
    if (state.compareIds.length === 0) return;
    comparisonTriggerRef.current = event.currentTarget;
    setComparisonOpen(true);
  };

  const closeComparison = () => {
    setComparisonOpen(false);
    (comparisonTriggerRef.current?.isConnected ? comparisonTriggerRef.current : comparisonCtaRef.current)?.focus();
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

  const copyEstimateLink = async (estimate) => {
    if (!navigator.clipboard?.writeText) return false;
    const params = new URLSearchParams(serializeUrlState(state));
    params.set("estimate", JSON.stringify(estimate));
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
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

  const openDetail = (detailId, event) => {
    detailTriggerRef.current = event.currentTarget;
    changeFilters({ detailId });
  };

  const closeDetail = () => {
    const trigger = detailTriggerRef.current;
    changeFilters({ detailId: "" });
    requestAnimationFrame(() => trigger?.focus());
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
                onOpenDetail={openDetail}
                sortBy={state.sortBy}
                sortDirection={state.sortDirection}
                onSort={changeSort}
              />
            ) : (
              <EmptyState onClear={clearFilters} />
            )}
          </section>

          <aside className="comparison-slot" aria-label="对比区域">
            <button
              ref={comparisonCtaRef}
              className="compare-cta"
              type="button"
              aria-disabled={state.compareIds.length === 0}
              onClick={openComparison}
            >
              加入对比（{state.compareIds.length}）
            </button>
            {invalidCompareMessage ? (
              <p className="comparison-link-warning" role="status">{invalidCompareMessage}</p>
            ) : null}
            {comparisonLimitReached ? <p className="comparison-limit" role="status">最多选择 3 个模型</p> : null}
            <ComparisonTray
              models={normalizedModels}
              selectedIds={state.compareIds}
              onRemove={removeFromComparison}
              onClear={() => changeFilters({ compareIds: [] })}
              onOpenComparison={openComparison}
              onOpenCost={() => setView("calculator")}
            />
          </aside>
        </main>
      ) : view === "calculator" ? (
        <CostEstimator
          models={models}
          selectedIds={state.compareIds}
          currency={state.currency}
          onShare={copyEstimateLink}
          initialEstimate={importedEstimateRef.current}
        />
      ) : view === "updates" ? <UpdatesView updates={updates} providers={providers} />
        : <MethodologyView exchangeRate={exchangeRates[0]} />}
      {comparisonOpen ? (
        <div className="comparison-overlay">
          <ComparisonView
            models={selectedModels}
            currency={state.currency}
            onClose={closeComparison}
            onRemove={removeFromComparison}
            onCopyLink={copyComparisonLink}
          />
        </div>
      ) : null}
      {detailModel ? (
        <div className="detail-overlay">
          <ModelDetail
            model={detailModel}
            currency={state.currency}
            onClose={closeDetail}
            onAddToComparison={() => toggleCompare(detailModel.id)}
            isSelected={state.compareIds.includes(detailModel.id)}
            comparisonLimitReached={comparisonLimitReached}
          />
        </div>
      ) : null}
    </div>
  );
}
