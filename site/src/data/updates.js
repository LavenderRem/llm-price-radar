import { models } from "./catalog.js";

const verifiedAt = "2026-08-06";

export const updates = models.flatMap((model) => {
  const sourceUrl = model.pricing[model.pricing.length - 1].sourceUrl;

  return [
    Object.freeze({
      id: `${model.id}-added-20260806`,
      modelId: model.id,
      providerId: model.providerId,
      type: "model-added",
      effectiveAt: verifiedAt,
      verifiedAt,
      summary: `新增 ${model.displayName} 的公开 Token 价格`,
      sourceUrl,
    }),
    Object.freeze({
      id: `${model.id}-verified-20260806`,
      modelId: model.id,
      providerId: model.providerId,
      type: "price-verified",
      effectiveAt: verifiedAt,
      verifiedAt,
      summary: `核验 ${model.displayName} 的官方价格与适用条件`,
      sourceUrl,
    }),
  ];
});
