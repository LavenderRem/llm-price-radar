function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasPrice(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function filterAndSortModels(models, state = {}) {
  const query = typeof state.query === "string" ? state.query.trim().toLowerCase() : "";
  const providers = asArray(state.providers);
  const capabilities = asArray(state.capabilities);
  const sortBy = ["input", "output", "blended"].includes(state.sortBy)
    ? state.sortBy
    : "input";
  const direction = state.sortDirection === "desc" ? -1 : 1;

  return models
    .filter((model) => {
      const normalized = model.normalized ?? {};
      const searchable = `${model.displayName ?? ""} ${model.apiModelId ?? ""} ${model.providerId ?? ""}`
        .toLowerCase();
      const matchesQuery = !query || searchable.includes(query);
      const matchesProvider = !providers.length || providers.includes(model.providerId);
      const matchesCapabilities = !capabilities.length
        || capabilities.every((item) => model.capabilities?.includes(item));
      const matchesContext = !state.minContext || model.contextWindow >= state.minContext;
      const matchesCache = !state.hasCache || hasPrice(normalized.cachedInput);
      const matchesBatch = !state.hasBatch
        || hasPrice(normalized.batchInput) || hasPrice(normalized.batchOutput);

      return model.status === "active"
        && matchesQuery
        && matchesProvider
        && matchesCapabilities
        && matchesContext
        && matchesCache
        && matchesBatch;
    })
    .map((model, index) => ({ model, index }))
    .sort((left, right) => {
      const leftValue = left.model.normalized?.[sortBy];
      const rightValue = right.model.normalized?.[sortBy];
      const leftHasPrice = hasPrice(leftValue);
      const rightHasPrice = hasPrice(rightValue);

      if (!leftHasPrice || !rightHasPrice) {
        if (leftHasPrice !== rightHasPrice) return leftHasPrice ? -1 : 1;
        return left.index - right.index;
      }

      return leftValue === rightValue
        ? left.index - right.index
        : (leftValue - rightValue) * direction;
    })
    .map(({ model }) => model);
}
