import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../src/App.jsx";
import { ComparisonTray } from "../src/components/ComparisonTray.jsx";
import { ComparisonView } from "../src/components/ComparisonView.jsx";
import { toggleComparison } from "../src/domain/comparison.js";
import { parseUrlState } from "../src/domain/urlState.js";

const selectedModels = [
  {
    id: "a",
    displayName: "模型 A",
    providerName: "Provider A",
    capabilities: ["text", "vision"],
    contextWindow: 128000,
    pricing: [{ conditions: ["标准按量计费"], verifiedAt: "2026-08-06", sourceUrl: "https://example.com/a" }],
    normalized: { input: 2, output: 8, cachedInput: 0.5, batchInput: 1, batchOutput: 4 },
  },
  {
    id: "b",
    displayName: "模型 B",
    providerName: "Provider B",
    capabilities: ["text"],
    contextWindow: 64000,
    pricing: [{ conditions: ["Batch 另有折扣"], verifiedAt: "2026-08-06", sourceUrl: "https://example.com/b" }],
    normalized: { input: 1, output: 10 },
  },
];

it("保留前三个模型并在选择第四个时报告上限", () => {
  expect(toggleComparison(["a", "b", "c"], "d")).toEqual({
    ids: ["a", "b", "c"],
    limitReached: true,
  });
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
