import { render, screen } from "@testing-library/react";
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
});
