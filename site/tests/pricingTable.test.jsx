import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "../src/components/EmptyState.jsx";
import { FilterBar } from "../src/components/FilterBar.jsx";
import { PricingTable } from "../src/components/PricingTable.jsx";

const model = {
  id: "m1",
  providerId: "openai",
  providerName: "OpenAI",
  displayName: "Model 1",
  apiModelId: "model-1",
  capabilities: ["text", "vision"],
  contextWindow: 128000,
  pricing: [{ sourceUrl: "https://example.com/pricing" }],
  normalized: {
    input: 2,
    output: 8,
    cachedInput: 0.5,
    batchInput: 1,
    batchOutput: 4,
  },
};

describe("PricingTable", () => {
  it("选择模型并触发输入价格排序", async () => {
    const onToggleCompare = vi.fn();
    const onSort = vi.fn();
    render(
      <PricingTable
        models={[model]}
        currency="CNY"
        selectedIds={[]}
        onToggleCompare={onToggleCompare}
        onOpenDetail={() => {}}
        sortBy="input"
        sortDirection="asc"
        onSort={onSort}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /Model 1/ }));
    const inputSort = screen.getByRole("button", { name: /输入价格/ });
    await userEvent.click(inputSort);

    expect(onToggleCompare).toHaveBeenCalledWith("m1");
    expect(onSort).toHaveBeenCalledWith("input");
    expect(inputSort.closest("th")).toHaveAttribute("aria-sort", "ascending");
    expect(inputSort).not.toHaveAttribute("aria-sort");
  });

  it("用文字标记未公开价格并保留模型详情入口", () => {
    render(
      <PricingTable
        models={[{ ...model, normalized: { input: 2 } }]}
        currency="USD"
        selectedIds={[]}
        onToggleCompare={() => {}}
        onOpenDetail={() => {}}
        sortBy="input"
        sortDirection="asc"
        onSort={() => {}}
      />,
    );

    expect(screen.getAllByText("未公开").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /查看 Model 1 详情/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/每百万 Token/).length).toBeGreaterThan(0);
  });

  it("将当前模型数量作为礼貌播报区域", () => {
    render(
      <PricingTable
        models={[model]}
        currency="CNY"
        selectedIds={[]}
        onToggleCompare={() => {}}
        onOpenDetail={() => {}}
        sortBy="input"
        sortDirection="asc"
        onSort={() => {}}
      />,
    );

    expect(screen.getByText("共 1 个模型")).toHaveAttribute("aria-live", "polite");
  });

  it("使用带空 alt 的服务商位图，避免字母方块近似", () => {
    const { container } = render(
      <PricingTable
        models={[model]}
        currency="CNY"
        selectedIds={[]}
        onToggleCompare={() => {}}
        onOpenDetail={() => {}}
        sortBy="input"
        sortDirection="asc"
        onSort={() => {}}
      />,
    );

    const logos = [...container.querySelectorAll("img.provider-logo")];
    expect(logos).toHaveLength(2);
    expect(logos.every((logo) => logo.getAttribute("alt") === "")).toBe(true);
    expect(logos.every((logo) => logo.getAttribute("src")?.includes("openai"))).toBe(true);
    expect(container.querySelector(".provider-mark")).not.toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  afterEach(() => vi.useRealTimers());

  it("延迟提交搜索词并立即提交服务商筛选", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <FilterBar
        state={{
          query: "",
          providers: [],
          capabilities: [],
          minContext: 0,
          hasCache: false,
          hasBatch: false,
        }}
        providers={[{ id: "openai", name: "OpenAI" }]}
        onChange={onChange}
        onClear={() => {}}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索模型或提供商" }), {
      target: { value: "gpt" },
    });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(onChange).toHaveBeenCalledWith({ query: "gpt" });

    onChange.mockClear();
    fireEvent.click(screen.getByRole("checkbox", { name: "OpenAI" }));
    expect(onChange).toHaveBeenCalledWith({ providers: ["openai"] });
  });

  it("移动筛选面板支持命名、焦点管理和 Escape 关闭", async () => {
    const user = userEvent.setup();
    render(
      <FilterBar
        state={{
          query: "",
          providers: [],
          capabilities: [],
          minContext: 0,
          hasCache: false,
          hasBatch: false,
        }}
        providers={[{ id: "openai", name: "OpenAI" }]}
        onChange={() => {}}
        onClear={() => {}}
      />,
    );

    expect(screen.getByRole("group", { name: "服务商" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "模型类型" })).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "打开筛选" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "筛选模型" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭筛选" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "筛选模型" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

it("空状态可清除筛选", async () => {
  const onClear = vi.fn();
  render(<EmptyState onClear={onClear} />);

  expect(screen.getByRole("heading", { name: "没有符合条件的模型" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  expect(onClear).toHaveBeenCalledOnce();
});
