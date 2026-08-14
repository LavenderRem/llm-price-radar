import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../src/App.jsx";

describe("CodingPlansView", () => {
  it("opens coding plans and filters to IDE plans", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "编程套餐" }));
    await user.click(screen.getByRole("button", { name: "IDE" }));

    expect(screen.getByRole("heading", { name: "个人编程套餐" })).toBeInTheDocument();
    expect(screen.getAllByText("IDE").length).toBeGreaterThan(0);
    expect(screen.queryByText("CLI / 编程 Agent 专属示例")).not.toBeInTheDocument();
  });

  it("keeps the selected display currency after opening coding plans", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "USD" }));
    await user.click(screen.getByRole("button", { name: "编程套餐" }));

    expect(screen.getByRole("button", { name: "USD" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps no more than three selected plans in the plan comparison tray", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "编程套餐" }));
    for (const label of ["选择 Cursor Free", "选择 Cursor Pro", "选择 Cursor Pro+"]) {
      await user.click(screen.getByRole("checkbox", { name: label }));
    }
    await user.click(screen.getByRole("checkbox", { name: "选择 Cursor Ultra" }));

    expect(screen.getByText("对比清单 · 3/3")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "选择 Cursor Ultra" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("最多选择 3 项套餐");
  });

  it("names the selected plan in its comparison tray removal control", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "编程套餐" }));
    await user.click(screen.getByRole("checkbox", { name: "选择 Cursor Free" }));

    expect(screen.getByRole("button", { name: "移除 Cursor Free" })).toBeInTheDocument();
  });

  it("keeps plan selections separate from model comparison selections", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("checkbox", { name: /GPT-5.6 Terra/ })[0]);
    await user.click(screen.getByRole("button", { name: "编程套餐" }));
    await user.click(screen.getByRole("checkbox", { name: "选择 Cursor Free" }));
    await user.click(screen.getByRole("button", { name: "价格对比" }));

    expect(screen.getByRole("button", { name: "加入对比（1）" })).toBeInTheDocument();
  });
});
