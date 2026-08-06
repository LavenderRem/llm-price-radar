import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/App.jsx";
import { CostEstimator } from "../src/components/CostEstimator.jsx";

const models = [
  {
    id: "cached-model",
    displayName: "缓存模型",
    pricing: [{ currency: "CNY", unitTokens: 1000000, input: 2, cachedInput: 0.5, output: 8, batchInput: 1, batchCachedInput: 0.25, batchOutput: 4 }],
  },
  {
    id: "standard-model",
    displayName: "标准模型",
    pricing: [{ currency: "CNY", unitTokens: 1000000, input: 2, output: 8 }],
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

it("按输入的调用量展示每个选中模型的月度成本拆分", async () => {
  const user = userEvent.setup();
  render(<CostEstimator models={models} selectedIds={["cached-model", "standard-model"]} currency="CNY" onShare={() => Promise.resolve(true)} />);

  await user.clear(screen.getByRole("spinbutton", { name: "每月请求数" }));
  await user.type(screen.getByRole("spinbutton", { name: "每月请求数" }), "1000");
  await user.clear(screen.getByRole("spinbutton", { name: "平均输入 Token" }));
  await user.type(screen.getByRole("spinbutton", { name: "平均输入 Token" }), "1000");
  await user.clear(screen.getByRole("spinbutton", { name: "平均输出 Token" }));
  await user.type(screen.getByRole("spinbutton", { name: "平均输出 Token" }), "500");
  await user.clear(screen.getByRole("spinbutton", { name: "缓存命中率" }));
  await user.type(screen.getByRole("spinbutton", { name: "缓存命中率" }), "50");
  await user.clear(screen.getByRole("spinbutton", { name: "Batch 请求占比" }));
  await user.type(screen.getByRole("spinbutton", { name: "Batch 请求占比" }), "40");

  const cachedResult = screen.getByRole("article", { name: "缓存模型 成本估算" });
  expect(cachedResult).toHaveTextContent("普通输入¥0.60");
  expect(cachedResult).toHaveTextContent("缓存输入¥0.15");
  expect(cachedResult).toHaveTextContent("Batch¥0.25");
  expect(cachedResult).toHaveTextContent("输出¥3.20");
  expect(cachedResult).toHaveTextContent("总成本¥4.20");

  const standardResult = screen.getByRole("article", { name: "标准模型 成本估算" });
  expect(standardResult).toHaveTextContent("按标准输入价计算");
});

it("恢复可用的本地估算参数，并在损坏存储时使用默认值", () => {
  window.localStorage.setItem("model-price-estimator-v1", "{");
  const first = render(<CostEstimator models={models} selectedIds={["cached-model"]} currency="CNY" onShare={() => Promise.resolve(true)} />);
  expect(screen.getByRole("spinbutton", { name: "每月请求数" })).toHaveValue(100000);
  first.unmount();

  window.localStorage.setItem("model-price-estimator-v1", JSON.stringify({
    monthlyRequests: 2000,
    averageInputTokens: 300,
    averageOutputTokens: 100,
    cacheHitRatePercent: 20,
    batchSharePercent: 10,
    baselineModelId: "cached-model",
  }));
  render(<CostEstimator models={models} selectedIds={["cached-model"]} currency="CNY" onShare={() => Promise.resolve(true)} />);
  expect(screen.getByRole("spinbutton", { name: "每月请求数" })).toHaveValue(2000);
});

it("忽略本地存储中缺失或无效的字段，保留对应默认值", () => {
  window.localStorage.setItem("model-price-estimator-v1", JSON.stringify({
    monthlyRequests: 3000,
    cacheHitRatePercent: 150,
  }));
  render(<CostEstimator models={models} selectedIds={["cached-model"]} currency="CNY" onShare={() => Promise.resolve(true)} />);

  expect(screen.getByRole("spinbutton", { name: "每月请求数" })).toHaveValue(3000);
  expect(screen.getByRole("spinbutton", { name: "平均输入 Token" })).toHaveValue(2000);
  expect(screen.getByRole("spinbutton", { name: "缓存命中率" })).toHaveValue(100);
});

it("从主动分享的 estimate 参数恢复调用量", () => {
  const estimate = encodeURIComponent(JSON.stringify({
    monthlyRequests: 4321,
    averageInputTokens: 1000,
    averageOutputTokens: 500,
    cacheHitRatePercent: 10,
    batchSharePercent: 20,
    baselineModelId: "cached-model",
  }));
  window.history.replaceState(null, "", `?estimate=${estimate}`);
  render(<CostEstimator models={models} selectedIds={["cached-model"]} currency="CNY" onShare={() => Promise.resolve(true)} />);

  expect(screen.getByRole("spinbutton", { name: "每月请求数" })).toHaveValue(4321);
});

it("将 estimate 作为一次性导入，不让普通 URL 和对比链接泄露调用量", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const estimate = encodeURIComponent(JSON.stringify({ monthlyRequests: 4321 }));
  window.history.replaceState(null, "", `?compare=openai-gpt-5-6-terra&estimate=${estimate}`);
  render(<App />);

  await user.click(screen.getByRole("button", { name: "成本估算" }));
  expect(screen.getByRole("spinbutton", { name: "每月请求数" })).toHaveValue(4321);
  await user.click(screen.getByRole("button", { name: "USD" }));
  expect(window.location.search).not.toContain("estimate=");

  await user.click(screen.getByRole("button", { name: "价格对比" }));
  await user.type(screen.getByRole("searchbox"), "GPT");
  await waitFor(() => expect(window.location.search).toContain("q=GPT"));
  expect(window.location.search).not.toContain("estimate=");

  await user.click(screen.getByRole("button", { name: "加入对比（1）" }));
  await user.click(screen.getByRole("button", { name: "复制对比链接" }));
  expect(writeText).toHaveBeenCalledOnce();
  expect(writeText.mock.calls[0][0]).not.toContain("estimate=");
});

it("本地存储写入失败时仍保留内存中的估算状态", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is unavailable", "SecurityError");
  });
  render(<CostEstimator models={models} selectedIds={["cached-model"]} currency="CNY" onShare={() => Promise.resolve(true)} />);

  const requests = screen.getByRole("spinbutton", { name: "每月请求数" });
  fireEvent.change(requests, { target: { value: "1234" } });
  expect(requests).toHaveValue(1234);
});

it("限制数值范围并仅在点击分享估算时写入调用量参数", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  window.history.replaceState(null, "", "?compare=openai-gpt-5-6-terra");
  render(<App />);

  await user.click(screen.getByRole("button", { name: "成本估算" }));
  const requests = screen.getByRole("spinbutton", { name: "每月请求数" });
  fireEvent.change(requests, { target: { value: "-10" } });
  expect(requests).toHaveValue(0);
  expect(window.location.search).not.toContain("estimate=");

  await user.click(screen.getByRole("button", { name: "分享估算" }));
  expect(writeText).toHaveBeenCalledOnce();
  expect(writeText.mock.calls[0][0]).toContain("estimate=");
  expect(writeText.mock.calls[0][0]).toContain("monthlyRequests");
});
