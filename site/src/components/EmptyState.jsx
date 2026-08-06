import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";

export function EmptyState({ onClear }) {
  return (
    <section className="empty-state" aria-live="polite">
      <span className="empty-state-icon" aria-hidden="true">
        <Search size={24} />
      </span>
      <h2>没有符合条件的模型</h2>
      <p>调整搜索词或筛选条件后再试。</p>
      <button type="button" onClick={onClear}>
        <RotateCcw size={16} aria-hidden="true" />
        清除筛选
      </button>
    </section>
  );
}
