import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/App.jsx";
import { ComparisonTray } from "../src/components/ComparisonTray.jsx";
import { ComparisonView } from "../src/components/ComparisonView.jsx";
import { models as catalogModels } from "../src/data/catalog.js";
import { sanitizeComparisonIds, toggleComparison } from "../src/domain/comparison.js";
import { parseUrlState } from "../src/domain/urlState.js";

const selectedModels = [
  {
    id: "a",
    providerId: "openai",
    displayName: "模型 A",
    providerName: "Provider A",
    capabilities: ["text", "vision"],
    contextWindow: 128000,
    pricing: [{ conditions: ["标准按量计费"], verifiedAt: "2026-08-06", sourceUrl: "https://example.com/a" }],
    normalized: { currency: "CNY", unitTokens: 1000000, input: 2, output: 8, cachedInput: 0.5, batchInput: 1, batchOutput: 4 },
  },
  {
    id: "b",
    providerId: "google",
    displayName: "模型 B",
    providerName: "Provider B",
    capabilities: ["text"],
    contextWindow: 64000,
    pricing: [{ conditions: ["Batch 另有折扣"], verifiedAt: "2026-08-06", sourceUrl: "https://example.com/b" }],
    normalized: { currency: "CNY", unitTokens: 1000000, input: 1, output: 5 },
  },
];

it("保留前三个模型并在选择第四个时报告上限", () => {
  expect(toggleComparison(["a", "b", "c"], "d")).toEqual({
    ids: ["a", "b", "c"],
    limitReached: true,
  });
});

it("初始化时忽略未知和非在售模型，不让它们占用三个名额", () => {
  expect(sanitizeComparisonIds(
    ["unknown-a", "active-a", "retired-a", "active-b", "unknown-b"],
    [
      { id: "active-a", status: "active" },
      { id: "retired-a", status: "retired" },
      { id: "active-b", status: "active" },
    ],
  )).toEqual({ ids: ["active-a", "active-b"], removedCount: 3 });
});

afterEach(() => window.history.replaceState(null, "", "/"));

it("达到上限时保留已选模型并显示限制说明", async () => {
  window.history.replaceState(
    null,
    "",
    "?compare=openai-gpt-5-6-terra%2Copenai-gpt-5-6-luna%2Canthropic-claude-opus-5",
  );
  render(<App />);

  const fourthModel = screen.getByRole("checkbox", { name: /Claude Sonnet 5/ });
  await userEvent.click(fourthModel);

  expect(fourthModel).not.toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("最多选择 3 个模型");
});

it.each([
  ["unknown-a,unknown-b", 0, "链接中的 2 个模型已不可用，已忽略"],
  ["unknown-a,openai-gpt-5-6-terra,unknown-b", 1, "链接中的 2 个模型已不可用，已忽略"],
])("清洗初始对比链接 %s", async (compare, expectedCount, message) => {
  window.history.replaceState(null, "", `?compare=${compare}`);
  render(<App />);

  expect(screen.getByRole("button", { name: `加入对比（${expectedCount}）` })).toBeInTheDocument();
  expect(await screen.findByRole("status")).toHaveTextContent(message);
  expect(new URLSearchParams(window.location.search).get("compare"))
    .toBe(expectedCount ? "openai-gpt-5-6-terra" : null);
  expect(catalogModels.some((model) => model.id === "unknown-a")).toBe(false);
});

it("移除已选模型后可以加入新的模型", async () => {
  window.history.replaceState(
    null,
    "",
    "?compare=openai-gpt-5-6-terra%2Copenai-gpt-5-6-luna%2Canthropic-claude-opus-5",
  );
  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: "移除 GPT-5.6 Terra" }));
  const newModel = screen.getByRole("checkbox", { name: /Claude Sonnet 5/ });
  await userEvent.click(newModel);

  expect(newModel).toBeChecked();
});

it("允许从对比清单移除模型", async () => {
  const onRemove = vi.fn();
  render(
    <ComparisonTray
      models={selectedModels}
      selectedIds={["a", "b"]}
      onRemove={onRemove}
      onOpenComparison={() => {}}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "移除 模型 A" }));
  expect(onRemove).toHaveBeenCalledWith("a");
});

it("空对比时禁用打开入口", () => {
  render(<App />);

  const trigger = screen.getByRole("button", { name: "加入对比（0）" });
  expect(trigger).toHaveAttribute("aria-disabled", "true");
  expect(screen.queryByRole("button", { name: "查看对比详情" })).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("对比清单提供可操作的成本估算入口", async () => {
  const onOpenCost = vi.fn();
  render(
    <ComparisonTray
      models={selectedModels}
      selectedIds={["a"]}
      onRemove={() => {}}
      onOpenComparison={() => {}}
      onOpenCost={onOpenCost}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "前往成本估算" }));
  expect(onOpenCost).toHaveBeenCalledOnce();
});

it("对比清单使用品牌位图并展示参考月成本与最低成本文字", () => {
  const { container } = render(
    <ComparisonTray
      models={selectedModels}
      selectedIds={["a", "b"]}
      onRemove={() => {}}
      onOpenComparison={() => {}}
      onOpenCost={() => {}}
    />,
  );

  const logos = [...container.querySelectorAll("img.provider-logo")];
  expect(logos).toHaveLength(2);
  expect(logos.every((logo) => logo.getAttribute("alt") === "")).toBe(true);
  expect(screen.getByText("参考月用量：输入 10M / 输出 5M")).toBeInTheDocument();
  expect(screen.getByText("¥60.00")).toBeInTheDocument();
  expect(screen.getByText("¥35.00")).toBeInTheDocument();
  expect(screen.getByText("最低月成本")).toBeInTheDocument();
});

it("从对比清单可进入成本估算视图", async () => {
  window.history.replaceState(null, "", "?compare=openai-gpt-5-6-terra");
  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: "前往成本估算" }));
  expect(screen.getAllByText("成本估算").length).toBeGreaterThan(1);
});

it("展示完整价格字段并在复制成功后给出状态", async () => {
  render(
    <ComparisonView
      models={selectedModels}
      currency="CNY"
      onClose={() => {}}
      onRemove={() => {}}
      onCopyLink={() => Promise.resolve(true)}
    />,
  );

  expect(screen.getByText("标准输入")).toBeInTheDocument();
  expect(screen.getByText("标准输出")).toBeInTheDocument();
  expect(screen.getByText("缓存输入")).toBeInTheDocument();
  expect(screen.getByText("Batch 输入 / 输出")).toBeInTheDocument();
  expect(screen.getByText("上下文窗口")).toBeInTheDocument();
  expect(screen.getByText("计费条件")).toBeInTheDocument();
  expect(screen.getByText("核验日期")).toBeInTheDocument();
  expect(screen.getByText("官方来源")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "复制对比链接" }));
  expect(await screen.findByRole("status")).toHaveTextContent("链接已复制");
});

it("打开对比视图时将焦点置于关闭按钮", () => {
  render(
    <ComparisonView
      models={selectedModels}
      currency="CNY"
      onClose={() => {}}
      onRemove={() => {}}
      onCopyLink={() => Promise.resolve(true)}
    />,
  );

  expect(screen.getByRole("button", { name: "关闭对比" })).toHaveFocus();
});

it("对比弹层拦截 Tab、支持 Escape 关闭", () => {
  const onClose = vi.fn();
  render(
    <ComparisonView
      models={selectedModels}
      currency="CNY"
      onClose={onClose}
      onRemove={() => {}}
      onCopyLink={() => Promise.resolve(true)}
    />,
  );

  const closeButton = screen.getByRole("button", { name: "关闭对比" });
  const copyButton = screen.getByRole("button", { name: "复制对比链接" });
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(copyButton).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(closeButton).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
});

it("关闭或移除最后一个模型时收起弹层并恢复入口焦点", async () => {
  window.history.replaceState(null, "", "?compare=openai-gpt-5-6-terra");
  render(<App />);

  const trigger = screen.getByRole("button", { name: "加入对比（1）" });
  await userEvent.click(trigger);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(trigger).toHaveFocus();

  await userEvent.click(trigger);
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "移除 GPT-5.6 Terra" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveAttribute("aria-disabled", "true");
  expect(trigger).toHaveFocus();
});

it("复制失败和最低价标签都会向用户说明状态", async () => {
  render(
    <ComparisonView
      models={selectedModels}
      currency="CNY"
      onClose={() => {}}
      onRemove={() => {}}
      onCopyLink={() => Promise.resolve(false)}
    />,
  );

  expect(screen.getAllByText("当前最低价")).toHaveLength(3);
  await userEvent.click(screen.getByRole("button", { name: "复制对比链接" }));
  expect(await screen.findByRole("status")).toHaveTextContent("无法复制链接");
});

it("复制的对比链接可恢复三个已选模型", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  window.history.replaceState(
    null,
    "",
    "?compare=openai-gpt-5-6-terra%2Copenai-gpt-5-6-luna%2Canthropic-claude-opus-5",
  );
  render(<App />);

  await userEvent.click(screen.getByRole("button", { name: "查看对比详情" }));
  await userEvent.click(screen.getByRole("button", { name: "复制对比链接" }));

  expect(await screen.findByRole("status")).toHaveTextContent("链接已复制");
  const copiedState = parseUrlState(new URL(writeText.mock.calls[0][0]).search);
  expect(copiedState.compareIds).toEqual([
    "openai-gpt-5-6-terra",
    "openai-gpt-5-6-luna",
    "anthropic-claude-opus-5",
  ]);
});
