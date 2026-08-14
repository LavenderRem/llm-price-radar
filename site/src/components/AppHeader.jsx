import Clock from "lucide-react/dist/esm/icons/clock.mjs";
import Sun from "lucide-react/dist/esm/icons/sun.mjs";
import modelPriceMark from "../assets/brand/model-price-mark.png";

const views = [
  { id: "pricing", label: "价格对比" },
  { id: "calculator", label: "成本估算" },
  { id: "updates", label: "更新记录" },
  { id: "methodology", label: "计价说明" },
];

export function AppHeader({ view, currency, priceVerifiedAt, sourceCheckedAt, onViewChange, onCurrencyChange }) {
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <img className="brand-mark" src={modelPriceMark} alt="" draggable="false" />
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
        <p className="verified-at" title="人工核验并写入价格目录的日期">
          <Clock size={16} aria-hidden="true" />
          <span>价格数据核验于 {priceVerifiedAt}</span>
        </p>
        <p className="verified-at source-checked-at" title="最近一次已合并的官方来源检查时间">
          <Clock size={16} aria-hidden="true" />
          <span>官方来源检查于 {sourceCheckedAt ? sourceCheckedAt.slice(0, 10) : "未检查"}</span>
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
