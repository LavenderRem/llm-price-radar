import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import Sun from "lucide-react/dist/esm/icons/sun.mjs";
import Tag from "lucide-react/dist/esm/icons/tag.mjs";

const views = [
  { id: "pricing", label: "价格对比" },
  { id: "calculator", label: "成本估算" },
  { id: "updates", label: "更新记录" },
  { id: "methodology", label: "计价说明" },
];

export function AppHeader({ view, currency, verifiedAt, onViewChange, onCurrencyChange }) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <Tag size={20} strokeWidth={2.3} />
        </span>
        <h1>模型价签</h1>
      </div>

      <nav className="primary-nav" aria-label="主要导航">
        {views.map((item) => (
          <button
            className="nav-button"
            key={item.id}
            type="button"
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => onViewChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-tools">
        <p className="verified-at">
          <Clock size={16} aria-hidden="true" />
          <span>数据更新于 {verifiedAt}</span>
        </p>
        <div className="currency-switch" role="group" aria-label="计价货币">
          {["CNY", "USD"].map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={currency === item}
              onClick={() => onCurrencyChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <Sun className="theme-indicator" size={19} aria-hidden="true" />
      </div>
    </header>
  );
}
