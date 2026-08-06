const sortKeys = ["input", "output", "blended"];
const currencies = ["CNY", "USD"];

function split(value) {
  return value ? [...new Set(value.split(",").filter(Boolean))] : [];
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function sortBy(value) {
  return sortKeys.includes(value) ? value : "input";
}

function currency(value) {
  return currencies.includes(value) ? value : "CNY";
}

function compareIds(value) {
  return [...new Set(array(value).filter(Boolean))].slice(0, 3);
}

export function parseUrlState(search) {
  const params = new URLSearchParams(search);

  return {
    query: params.get("q") ?? "",
    providers: split(params.get("providers")),
    capabilities: split(params.get("capabilities")),
    minContext: positiveNumber(params.get("context")),
    minInputPrice: positiveNumber(params.get("minPrice")),
    maxInputPrice: positiveNumber(params.get("maxPrice")),
    hasCache: params.get("cache") === "1",
    hasBatch: params.get("batch") === "1",
    sortBy: sortBy(params.get("sort")),
    sortDirection: params.get("direction") === "desc" ? "desc" : "asc",
    currency: currency(params.get("currency")),
    compareIds: compareIds(split(params.get("compare"))),
    detailId: params.get("detail") ?? "",
  };
}

export function serializeUrlState(state) {
  const params = new URLSearchParams();
  const providers = array(state.providers);
  const capabilities = array(state.capabilities);
  const selectedCompareIds = compareIds(state.compareIds);

  if (state.query) params.set("q", state.query);
  if (providers.length) params.set("providers", providers.join(","));
  if (capabilities.length) params.set("capabilities", capabilities.join(","));
  if (positiveNumber(state.minContext)) params.set("context", String(positiveNumber(state.minContext)));
  if (positiveNumber(state.minInputPrice)) {
    params.set("minPrice", String(positiveNumber(state.minInputPrice)));
  }
  if (positiveNumber(state.maxInputPrice)) {
    params.set("maxPrice", String(positiveNumber(state.maxInputPrice)));
  }
  if (state.hasCache) params.set("cache", "1");
  if (state.hasBatch) params.set("batch", "1");
  params.set("sort", sortBy(state.sortBy));
  params.set("direction", state.sortDirection === "desc" ? "desc" : "asc");
  params.set("currency", currency(state.currency));
  if (selectedCompareIds.length) params.set("compare", selectedCompareIds.join(","));
  if (state.detailId) params.set("detail", state.detailId);

  return `?${params.toString()}`;
}
