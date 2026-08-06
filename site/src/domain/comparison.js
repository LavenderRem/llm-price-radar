export function toggleComparison(selectedIds, modelId) {
  if (selectedIds.includes(modelId)) {
    return { ids: selectedIds.filter((id) => id !== modelId), limitReached: false };
  }
  if (selectedIds.length >= 3) return { ids: selectedIds, limitReached: true };
  return { ids: [...selectedIds, modelId], limitReached: false };
}

export function sanitizeComparisonIds(selectedIds, models) {
  const activeIds = new Set(models
    .filter((model) => model.status === "active")
    .map((model) => model.id));
  const seen = new Set();
  const ids = [];
  let removedCount = 0;

  for (const id of selectedIds) {
    if (!activeIds.has(id) || seen.has(id) || ids.length >= 3) {
      removedCount += 1;
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return { ids, removedCount };
}
