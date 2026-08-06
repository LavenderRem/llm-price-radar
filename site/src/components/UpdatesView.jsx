import { useMemo, useState } from "react";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down.mjs";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up.mjs";
import BadgeCheck from "lucide-react/dist/esm/icons/badge-check.mjs";
import CircleOff from "lucide-react/dist/esm/icons/circle-off.mjs";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";

const eventTypes = {
  "price-increased": { label: "价格上涨", Icon: ArrowUp },
  "price-decreased": { label: "价格下降", Icon: ArrowDown },
  "model-added": { label: "新增模型", Icon: Plus },
  "model-retired": { label: "模型下线", Icon: CircleOff },
  "price-verified": { label: "仅核验", Icon: BadgeCheck },
};

export function UpdatesView({ updates, providers }) {
  const [providerId, setProviderId] = useState("");
  const [eventType, setEventType] = useState("");
  const sortedUpdates = useMemo(() => updates
    .filter((update) => (!providerId || update.providerId === providerId) && (!eventType || update.type === eventType))
    .toSorted((left, right) => right.effectiveAt.localeCompare(left.effectiveAt)), [eventType, providerId, updates]);

  return (
    <main className="updates-view">
      <header className="content-view-header">
        <p>价格变动与核验留档</p>
        <h2>更新记录</h2>
      </header>
      <div className="updates-filters" aria-label="更新记录筛选">
        <label>服务商
          <select value={providerId} onChange={(event) => setProviderId(event.target.value)}>
            <option value="">全部服务商</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
        </label>
        <label>事件类型
          <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
            <option value="">全部事件</option>
            {Object.entries(eventTypes).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
          </select>
        </label>
      </div>
      {sortedUpdates.length ? (
        <ol className="updates-list">
          {sortedUpdates.map((update) => {
            const event = eventTypes[update.type] ?? eventTypes["price-verified"];
            const Icon = event.Icon;
            const provider = providers.find((item) => item.id === update.providerId);
            return (
              <li key={update.id}>
                <Icon size={18} aria-hidden="true" />
                <div>
                  <div className="update-meta"><span>{event.label}</span><time dateTime={update.effectiveAt}>{update.effectiveAt}</time></div>
                  <h3>{provider?.name ?? "未知服务商"}</h3>
                  <p>{update.summary}</p>
                  <small>核验日期：{update.verifiedAt}</small>
                  <a href={update.sourceUrl} target="_blank" rel="noreferrer">官方来源 <ExternalLink size={13} aria-hidden="true" /></a>
                </div>
              </li>
            );
          })}
        </ol>
      ) : <p className="updates-empty" role="status">未找到符合条件的更新记录</p>}
    </main>
  );
}
