export function toggleComparison(selectedIds, modelId) {
  if (selectedIds.includes(modelId)) {
    return { ids: selectedIds.filter((id) => id !== modelId), limitReached: false };
  }
  if (selectedIds.length >= 3) return { ids: selectedIds, limitReached: true };
  return { ids: [...selectedIds, modelId], limitReached: false };
}
