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
  let invalidCount = 0;
  let overflowCount = 0;
  let duplicatesRemoved = 0;

  for (const id of selectedIds) {
    if (!activeIds.has(id)) {
      invalidCount += 1;
      continue;
    }
    if (seen.has(id)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(id);
    if (ids.length >= 3) {
      overflowCount += 1;
      continue;
    }
    ids.push(id);
  }

  return {
    ids,
    invalidCount,
    overflowCount,
    duplicatesRemoved,
    normalizedChanged: invalidCount + overflowCount + duplicatesRemoved > 0,
  };
}
