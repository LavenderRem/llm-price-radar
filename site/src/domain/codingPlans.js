function required(value, path) {
  if (value === undefined || value === null || value === "") throw new Error(path);
}

function httpsUrl(value, path) {
  required(value, path);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error(path);
    return url;
  } catch {
    throw new Error(path);
  }
}

const CODING_SURFACES = new Set(["IDE", "CLI", "Agent"]);

function validDate(value, path) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(path);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(path);
  }
}

function displayablePriceAmount(price, path) {
  if (price.status === "unpublished") {
    if (price.amount !== null) throw new Error(`${path}.amount`);
    return;
  }
  if (!Number.isFinite(price.amount) || price.amount < 0) throw new Error(`${path}.amount`);
}

export function validateCodingPlans(plans, providers) {
  if (!Array.isArray(plans) || plans.length === 0) throw new Error("codingPlans");
  if (!Array.isArray(providers)) throw new Error("providers");

  const providerHostById = new Map(providers.map((provider, index) => [
    provider.id,
    httpsUrl(provider.officialPricingUrl, `providers[${index}].officialPricingUrl`).hostname,
  ]));
  const planIds = new Set();
  for (const [index, plan] of plans.entries()) {
    const base = `codingPlans[${index}]`;
    required(plan.id, `${base}.id`);
    if (planIds.has(plan.id)) throw new Error(`${base}.id`);
    planIds.add(plan.id);
    if (!providerHostById.has(plan.providerId)) throw new Error(`${base}.providerId`);
    required(plan.productName, `${base}.productName`);
    required(plan.planName, `${base}.planName`);
    if (plan.planType !== "individual-coding") throw new Error(`${base}.planType`);
    if (!plan.price || typeof plan.price !== "object") throw new Error(`${base}.price`);
    required(plan.price.currency, `${base}.price.currency`);
    if (plan.price.period !== "month") throw new Error(`${base}.price.period`);
    displayablePriceAmount(plan.price, `${base}.price`);
    required(plan.includedUsage, `${base}.includedUsage`);
    if (!plan.allowancePolicy || typeof plan.allowancePolicy !== "object") {
      throw new Error(`${base}.allowancePolicy`);
    }
    if (plan.allowancePolicy.status === "unpublished") {
      // Explicitly retain official non-disclosure instead of estimating an allowance.
    } else if (plan.allowancePolicy.status !== "published" || !plan.allowancePolicy.label) {
      throw new Error(`${base}.allowancePolicy`);
    }
    if (!Array.isArray(plan.codingSurfaces)
      || plan.codingSurfaces.length === 0
      || plan.codingSurfaces.some((surface) => !CODING_SURFACES.has(surface))) {
      throw new Error(`${base}.codingSurfaces`);
    }
    const officialUrl = httpsUrl(plan.officialUrl, `${base}.officialUrl`);
    if (officialUrl.hostname !== providerHostById.get(plan.providerId)) {
      throw new Error(`${base}.officialUrl`);
    }
    validDate(plan.verifiedAt, `${base}.verifiedAt`);
    required(plan.officialSummary, `${base}.officialSummary`);
    const sourceUrl = httpsUrl(plan.sourceUrl, `${base}.sourceUrl`);
    if (sourceUrl.hostname !== providerHostById.get(plan.providerId)) {
      throw new Error(`${base}.sourceUrl`);
    }
  }
}

function convertCurrency(amount, fromCurrency, toCurrency, exchangeRates) {
  const exchangeRate = exchangeRates.find((rate) => (
    (rate.base ?? rate.baseCurrency) === fromCurrency
      && (rate.quote ?? rate.quoteCurrency) === toCurrency
  ));
  if (!exchangeRate) return null;
  return amount * exchangeRate.rate;
}

export function normalizeCodingPlan(plan, currency, exchangeRates) {
  const displayPrice = plan.price.amount === null
    ? null
    : currency === plan.price.currency
      ? plan.price.amount
      : convertCurrency(plan.price.amount, plan.price.currency, currency, exchangeRates);
  return {
    ...plan,
    displayPrice,
    displayCurrency: currency,
    displayPriceLabel: displayPrice === null ? "未公开" : undefined,
    allowanceLabel: plan.allowancePolicy.status === "unpublished"
      ? "未公开"
      : plan.allowancePolicy.label,
  };
}

export function filterAndSortCodingPlans(plans, { surfaces = [], freeOnly = false } = {}) {
  return plans
    .filter((plan) => !surfaces.length || surfaces.some((surface) => plan.codingSurfaces.includes(surface)))
    .filter((plan) => !freeOnly || plan.price.amount === 0)
    .toSorted((left, right) => {
      const leftAmount = left.price.amount ?? Number.POSITIVE_INFINITY;
      const rightAmount = right.price.amount ?? Number.POSITIVE_INFINITY;
      return leftAmount - rightAmount || left.productName.localeCompare(right.productName);
    });
}

export function toggleCodingPlanComparison(ids, planId) {
  if (ids.includes(planId)) return { ids: ids.filter((id) => id !== planId), limitReached: false };
  if (ids.length >= 3) return { ids, limitReached: true };
  return { ids: [...ids, planId], limitReached: false };
}

export function sanitizeCodingPlanComparisonIds(ids, plans) {
  const planIds = new Set(plans.map((plan) => plan.id));
  const seen = new Set();
  const result = [];
  let invalidCount = 0;
  let overflowCount = 0;
  let duplicatesRemoved = 0;

  for (const id of ids) {
    if (!planIds.has(id)) {
      invalidCount += 1;
    } else if (seen.has(id)) {
      duplicatesRemoved += 1;
    } else {
      seen.add(id);
      if (result.length >= 3) {
        overflowCount += 1;
      } else {
        result.push(id);
      }
    }
  }

  return {
    ids: result,
    invalidCount,
    overflowCount,
    duplicatesRemoved,
    normalizedChanged: invalidCount + overflowCount + duplicatesRemoved > 0,
  };
}
