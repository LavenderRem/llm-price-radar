import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../src/App.jsx";

describe("App", () => {
  it("显示产品名称", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "模型价签" })).toBeInTheDocument();
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

  it("打开模型详情后展示计费信息，关闭时恢复详情按钮焦点", async () => {
    const user = userEvent.setup();
    render(<App />);

    const detailButton = screen.getAllByRole("button", { name: "查看 GPT-5.6 Terra 详情" })[0];
    await user.click(detailButton);

    const dialog = screen.getByRole("dialog", { name: "GPT-5.6 Terra 详情" });
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

  it("在更新记录中可按服务商和价格下降筛选", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "更新记录" }));
    await user.selectOptions(screen.getByLabelText("服务商"), "openai");
    await user.selectOptions(screen.getByLabelText("事件类型"), "price-decreased");

    expect(screen.getByText("未找到符合条件的更新记录")).toBeInTheDocument();
  });

  it("在计价说明中展示汇率来源与免责声明", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "计价说明" }));

    expect(screen.getByRole("heading", { name: "计价说明" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "中国人民银行汇率来源" })).toBeInTheDocument();
    expect(screen.getByText("最终价格以服务商官方页面为准")).toBeInTheDocument();
  });
});
