import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App.jsx";

describe("App", () => {
  it("显示产品名称", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "模型价签" })).toBeInTheDocument();
  });
});
