import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../src/App.jsx";

describe("App", () => {
  it("显示产品名称", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { name: "模型价签" })).toBeInTheDocument();
    expect(container.querySelector("img.brand-mark")).toHaveAttribute("alt", "");
    expect(container.querySelector("img.brand-mark")?.getAttribute("src"))
      .toContain("model-price-mark");
  });

  it("分别展示价格数据核验时间与官方来源检查时间", () => {
    render(<App />);

    expect(screen.getByText(/价格数据核验于 2026-08-06/)).toBeInTheDocument();
    expect(screen.getByText(/官方来源检查于 2026-08-13/)).toBeInTheDocument();
  });

  it("通过键盘切换三个导航视图的活动态", async () => {
    const user = userEvent.setup();
    render(<App />);

    const pricing = screen.getByRole("button", { name: "价格对比" });
    const calculator = screen.getByRole("button", { name: "成本估算" });
    const updates = screen.getByRole("button", { name: "更新记录" });

    expect(pricing).toHaveAttribute("aria-current", "page");

    calculator.focus();
    await user.keyboard("{Enter}");
    expect(calculator).toHaveAttribute("aria-current", "page");

    updates.focus();
    await user.keyboard(" ");
    expect(updates).toHaveAttribute("aria-current", "page");
  });

  it("显示编程套餐导航入口", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "编程套餐" })).toBeInTheDocument();
  });

  it("打开模型详情后展示计费信息，关闭时恢复详情按钮焦点", async () => {
    const user = userEvent.setup();
    render(<App />);

    const detailButton = screen.getAllByRole("button", { name: "查看 GPT-5.6 Terra 详情" })[0];
    await user.click(detailButton);

    const dialog = screen.getByRole("dialog", { name: "GPT-5.6 Terra 详情" });
    expect(dialog).toHaveTextContent("OpenAI · 在售");
    expect(dialog).toHaveTextContent("gpt-5.6-terra");
    expect(dialog).toHaveTextContent("计费条件");
    expect(dialog).toHaveTextContent("官方来源");
    expect(dialog).toHaveTextContent("核验日期");
    expect(window.location.search).toContain("detail=openai-gpt-5-6-terra");

    await user.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(detailButton).toHaveFocus();
    expect(window.location.search).not.toContain("detail=");
  });

  it("模型详情支持焦点循环和 Escape 关闭", async () => {
    const user = userEvent.setup();
    render(<App />);

    const detailButton = screen.getAllByRole("button", { name: "查看 GPT-5.6 Terra 详情" })[0];
    await user.click(detailButton);
    const dialog = screen.getByRole("dialog", { name: "GPT-5.6 Terra 详情" });
    const closeButton = within(dialog).getByRole("button", { name: "关闭详情" });
    const addButton = within(dialog).getByRole("button", { name: "加入对比" });

    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(addButton).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(detailButton).toHaveFocus();
  });

  it("更新记录导航展示可筛选页面", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "更新记录" }));
    expect(screen.getByLabelText("服务商")).toBeInTheDocument();
    expect(screen.getByLabelText("事件类型")).toBeInTheDocument();
  });

  it("阶梯价同时展示原始币种和统一折算价", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "USD" }));
    await user.click(screen.getAllByRole("button", { name: "查看 Qwen3-Max 详情" })[0]);

    const tiers = screen.getByRole("region", { name: "阶梯价格" });
    expect(tiers).toHaveTextContent("输入 ¥2.50 CNY / 每百万 Token");
    expect(tiers).toHaveTextContent("折合：输入 $0.37 USD / 每百万 Token");
    expect(tiers).toHaveTextContent("折合 Batch：输入 $0.18 USD / 每百万 Token");
  });

  it("OpenAI 长上下文详情保留两档完整缓存与 Batch 区间", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "查看 GPT-5.6 Terra 详情" })[0]);
    const tiers = screen.getByRole("region", { name: "阶梯价格" });
    expect(tiers).toHaveTextContent("1–272,000 Token");
    expect(tiers).toHaveTextContent("272,001–1,050,000 Token");
    expect(tiers).toHaveTextContent("缓存输入 $0.20 USD / 每百万 Token");
    expect(tiers).toHaveTextContent("缓存写入 $2.50 USD / 每百万 Token");
    expect(tiers).toHaveTextContent("Batch：输入 $2.00 USD / 每百万 Token；缓存输入 $0.20 USD / 每百万 Token；输出 $9.00 USD / 每百万 Token");
  });

  it("详情中的对比按钮反映选择状态并可移出", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "查看 GPT-5.6 Terra 详情" })[0]);
    const dialog = screen.getByRole("dialog", { name: "GPT-5.6 Terra 详情" });
    const add = within(dialog).getByRole("button", { name: "加入对比" });
    expect(add).toHaveAttribute("aria-pressed", "false");
    await user.click(add);

    const remove = within(dialog).getByRole("button", { name: "移出对比" });
    expect(remove).toHaveAttribute("aria-pressed", "true");
    await user.click(remove);
    expect(within(dialog).getByRole("button", { name: "加入对比" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("详情内达到三模型上限时在弹层中反馈", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "?compare=openai-gpt-5-6-terra,openai-gpt-5-6-luna,anthropic-claude-opus-5");
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "查看 Claude Sonnet 5 详情" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Claude Sonnet 5 详情" });
    await user.click(within(dialog).getByRole("button", { name: "加入对比" }));

    expect(within(dialog).getByRole("status")).toHaveTextContent("最多选择 3 个模型");
    expect(within(dialog).getByRole("button", { name: "加入对比" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  it("Embedding 筛选在无匹配模型时展示正确空态", async () => {
    window.history.replaceState(null, "", "?capabilities=embedding");
    render(<App />);

    expect(screen.getByRole("heading", { name: "没有符合条件的模型" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Embedding" })).toBeChecked();
  });

  it("在计价说明中展示汇率来源与免责声明", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "计价说明" }));

    expect(screen.getByRole("heading", { name: "计价说明" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "中国人民银行汇率来源" })).toBeInTheDocument();
    expect(screen.getByText("最终价格以服务商官方页面为准")).toBeInTheDocument();
  });

  it("离散目录操作 push 历史，防抖搜索 replace 当前历史", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/");
    render(<App />);
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");

    await user.click(screen.getByRole("button", { name: "USD" }));
    await user.click(screen.getAllByRole("button", { name: "查看 GPT-5.6 Terra 详情" })[0]);
    await user.click(screen.getByRole("button", { name: "关闭详情" }));
    await user.click(screen.getByRole("checkbox", { name: /GPT-5.6 Terra/ }));
    expect(pushSpy).toHaveBeenCalledTimes(4);

    pushSpy.mockClear();
    replaceSpy.mockClear();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "DeepSeek" } });
    await waitFor(() => expect(window.location.search).toContain("q=DeepSeek"));
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();

    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });
});
