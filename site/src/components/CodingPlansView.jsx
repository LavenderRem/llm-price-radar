import { useMemo, useState } from "react";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";
import {
  filterAndSortCodingPlans,
  normalizeCodingPlan,
} from "../domain/codingPlans.js";

const filters = [
  { id: "all", label: "全部" },
  { id: "ide", label: "IDE", surfaces: ["IDE"] },
  { id: "cli-agent", label: "CLI / Agent", surfaces: ["CLI", "Agent"] },
  { id: "free", label: "免费套餐", freeOnly: true },
];

function displayPrice(plan) {
  if (!Number.isFinite(plan.displayPrice)) return "未公开";
  const symbol = plan.displayCurrency === "CNY" ? "¥" : "$";
  return `${symbol}${plan.displayPrice.toFixed(plan.displayPrice < 0.1 ? 3 : 2)}`;
}

function billingLabel(plan) {
  if (!Number.isFinite(plan.displayAnnualPrice)) return "月付";
  return `月付或年付（${plan.displayCurrency} ${plan.displayAnnualPrice.toFixed(0)}/年）`;
}

function PlanIdentity({ plan }) {
  return (
    <span className="plan-identity">
      <strong>{plan.productName}</strong>
      <span>{plan.planName}</span>
    </span>
  );
}

function PlanSelectionTray({ plans, selectedIds, onToggle, comparisonLimitReached }) {
  const selectedPlans = selectedIds
    .map((id) => plans.find((plan) => plan.id === id))
    .filter(Boolean);

  return (
    <aside className="plans-comparison-tray" aria-label="套餐对比清单">
      <div className="plans-comparison-heading">
        <strong>对比清单 · {selectedPlans.length}/3</strong>
        <span>最多选择 3 项</span>
      </div>
      {comparisonLimitReached ? <p className="plans-comparison-limit" role="status">最多选择 3 项套餐</p> : null}
      {selectedPlans.length === 0 ? (
        <p className="plans-comparison-empty">选择套餐后，在这里查看关键事实。</p>
      ) : (
        <ul className="plans-comparison-list">
          {selectedPlans.map((plan) => (
            <li key={plan.id}>
              <div>
                <PlanIdentity plan={plan} />
                <strong>{displayPrice(plan)} / 月</strong>
              </div>
              <dl>
                <div><dt>包含用量</dt><dd>{plan.includedUsage}</dd></div>
                <div><dt>额度与超额</dt><dd>{plan.allowanceLabel}</dd></div>
                <div><dt>编程入口</dt><dd>{plan.codingSurfaces.join(" / ")}</dd></div>
              </dl>
              <button type="button" aria-label={`移除 ${plan.productName} ${plan.planName}`} onClick={() => onToggle(plan.id)}>移除</button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function CodingPlansView({ plans, currency, exchangeRates, selectedIds, onTogglePlan, comparisonLimitReached }) {
  const [filterId, setFilterId] = useState("all");
  const activeFilter = filters.find((filter) => filter.id === filterId) ?? filters[0];
  const normalizedPlans = useMemo(
    () => plans.map((plan) => normalizeCodingPlan(plan, currency, exchangeRates)),
    [plans, currency, exchangeRates],
  );
  const visiblePlans = useMemo(
    () => filterAndSortCodingPlans(normalizedPlans, activeFilter),
    [normalizedPlans, activeFilter],
  );

  return (
    <main className="coding-plans-layout">
      <section className="coding-plans-main" aria-labelledby="coding-plans-heading">
        <header className="coding-plans-intro">
          <p>个人 AI 编程产品的官方套餐信息</p>
          <h2 id="coding-plans-heading">个人编程套餐</h2>
        </header>
        <div className="plans-filter-bar" aria-label="套餐筛选">
          {filters.map((filter) => (
            <button
              className={filter.id === filterId ? "is-active" : ""}
              key={filter.id}
              type="button"
              aria-pressed={filter.id === filterId}
              onClick={() => setFilterId(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="coding-plans-table-shell">
          <table className="coding-plans-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">加入套餐对比</span></th>
                <th scope="col">产品 / 套餐</th>
                <th scope="col">月费</th>
                <th scope="col">计费周期</th>
                <th scope="col">包含用量</th>
                <th scope="col">额度与超额</th>
                <th scope="col">编程入口</th>
                <th scope="col">官方来源</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlans.map((plan) => {
                const selected = selectedIds.includes(plan.id);
                return (
                  <tr className={selected ? "is-selected" : ""} key={plan.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`选择 ${plan.productName} ${plan.planName}`}
                        checked={selected}
                        onChange={() => onTogglePlan(plan.id)}
                      />
                    </td>
                    <td><PlanIdentity plan={plan} /></td>
                    <td className="plans-price"><strong>{displayPrice(plan)}</strong><small>{plan.displayCurrency}</small></td>
                    <td>{billingLabel(plan)}</td>
                    <td>{plan.includedUsage}</td>
                    <td>{plan.allowanceLabel}</td>
                    <td><span className="plans-surface-tags">{plan.codingSurfaces.map((surface) => <span key={surface}>{surface}</span>)}</span></td>
                    <td>
                      <a className="source-link" href={plan.officialUrl} target="_blank" rel="noreferrer">
                        查看 {plan.productName} {plan.planName} 官方来源
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <PlanSelectionTray
        plans={normalizedPlans}
        selectedIds={selectedIds}
        onToggle={onTogglePlan}
        comparisonLimitReached={comparisonLimitReached}
      />
    </main>
  );
}
