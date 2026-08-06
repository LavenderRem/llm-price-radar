import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UpdatesView } from "../src/components/UpdatesView.jsx";

const providers = [
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google" },
];

const updates = [
  { id: "up", modelId: "one", providerId: "openai", type: "price-increased", effectiveAt: "2026-06-01", verifiedAt: "2026-06-02", summary: "价格上涨", sourceUrl: "https://openai.com/pricing" },
  { id: "down", modelId: "one", providerId: "openai", type: "price-decreased", effectiveAt: "2026-06-03", verifiedAt: "2026-06-03", summary: "价格下降", sourceUrl: "https://openai.com/pricing" },
  { id: "added", modelId: "two", providerId: "google", type: "model-added", effectiveAt: "2026-05-01", verifiedAt: "2026-05-01", summary: "新增模型", sourceUrl: "https://ai.google.dev/pricing" },
  { id: "retired", modelId: "two", providerId: "google", type: "model-retired", effectiveAt: "2026-04-01", verifiedAt: "2026-04-01", summary: "模型下线", sourceUrl: "https://ai.google.dev/deprecations" },
  { id: "verified", modelId: "two", providerId: "google", type: "price-verified", effectiveAt: "2026-03-01", verifiedAt: "2026-03-01", summary: "仅核验", sourceUrl: "https://ai.google.dev/pricing" },
];

describe("UpdatesView", () => {
  it("为五类事件显示文字和图标，并按生效日期降序排列", () => {
    render(<UpdatesView updates={updates} providers={providers} />);

    for (const label of ["价格上涨", "价格下降", "新增模型", "模型下线", "仅核验"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("time")?.dateTime))
      .toEqual(["2026-06-03", "2026-06-01", "2026-05-01", "2026-04-01", "2026-03-01"]);
    expect(items.every((item) => item.querySelector("svg"))).toBe(true);
  });

  it("按服务商和价格下降过滤真实组件输出", async () => {
    const user = userEvent.setup();
    render(<UpdatesView updates={updates} providers={providers} />);

    await user.selectOptions(screen.getByLabelText("服务商"), "openai");
    await user.selectOptions(screen.getByLabelText("事件类型"), "price-decreased");

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("价格下降");
    expect(items[0]).toHaveTextContent("OpenAI");
  });
});
