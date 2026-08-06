import ExternalLink from "lucide-react/dist/esm/icons/external-link.mjs";

export function MethodologyView({ exchangeRate }) {
  return (
    <main className="methodology-view">
      <header className="content-view-header">
        <p>统一口径与适用边界</p>
        <h2>计价说明</h2>
      </header>
      <div className="methodology-grid">
        <section>
          <h3>统一口径</h3>
          <p>为便于横向比较，所有公开 Token 价格统一展示为每百万 Token；原始币种和原始计费信息仍保留在模型详情中。</p>
        </section>
        <section>
          <h3>汇率</h3>
          <p>当前折算使用 1 USD = {exchangeRate.rate} CNY，生效日期 {exchangeRate.effectiveAt}。</p>
          <a href={exchangeRate.source} target="_blank" rel="noreferrer">中国人民银行汇率来源 <ExternalLink size={14} aria-hidden="true" /></a>
        </section>
        <section>
          <h3>价格字段</h3>
          <p>输入为请求进入模型的 Token，输出为模型返回的 Token；缓存输入只适用于命中缓存的 Token。Batch 指异步批量接口，是否享有折扣以服务商规则为准。</p>
        </section>
        <section>
          <h3>阶梯与推理 Token</h3>
          <p>阶梯价按服务商公布的上下文或用量档位选取；未提供完整条件时不输出单一估算。若服务商将推理 Token 计入输出价格，详情会在计费条件中注明。</p>
        </section>
        <section>
          <h3>模态边界</h3>
          <p>文本、图像、音频和视频可能采用不同的计费单位与价格规则，因此本站不将不同模态的价格直接视为可比结果。</p>
        </section>
        <section className="methodology-disclaimer">
          <h3>免责声明</h3>
          <p>最终价格以服务商官方页面为准</p>
        </section>
      </div>
    </main>
  );
}
