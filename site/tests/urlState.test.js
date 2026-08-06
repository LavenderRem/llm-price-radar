import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { parseUrlState, serializeUrlState } from "../src/domain/urlState.js";
import { useUrlState } from "../src/hooks/useUrlState.js";

const defaults = {
  query: "",
  providers: [],
  capabilities: [],
  minContext: 0,
  minInputPrice: 0,
  maxInputPrice: 0,
  hasCache: false,
  hasBatch: false,
  sortBy: "input",
  sortDirection: "asc",
  currency: "CNY",
  compareIds: [],
  detailId: "",
};

it("序列化后恢复筛选和三个对比模型", () => {
  const state = {
    query: "mini",
    providers: ["openai", "google"],
    capabilities: ["text"],
    minContext: 128000,
    minInputPrice: 0.2,
    maxInputPrice: 3.5,
    hasCache: true,
    hasBatch: false,
    sortBy: "output",
    sortDirection: "asc",
    currency: "CNY",
    compareIds: ["a", "b", "c"],
    detailId: "a",
  };

  expect(parseUrlState(serializeUrlState(state))).toEqual(state);
});

it("为未知币种和排序字段回退，并为省略数组提供默认值", () => {
  expect(parseUrlState("?currency=EUR&sort=name"))
    .toEqual(defaults);
});

it("解析时去重并限制三个对比模型", () => {
  expect(parseUrlState("?compare=a,b,a,c,d").compareIds)
    .toEqual(["a", "b", "c"]);
});

it("序列化时去重并限制三个对比模型", () => {
  expect(serializeUrlState({ ...defaults, compareIds: ["a", "b", "a", "c", "d"] }))
    .toContain("compare=a%2Cb%2Cc");
});

it("解析并序列化当前币种的输入价格区间", () => {
  const serialized = serializeUrlState({ ...defaults, minInputPrice: 0.25, maxInputPrice: 8 });

  expect(serialized).toContain("minPrice=0.25");
  expect(serialized).toContain("maxPrice=8");
  expect(parseUrlState(serialized)).toMatchObject({ minInputPrice: 0.25, maxInputPrice: 8 });
});

it("普通 URL 状态忽略主动分享的 estimate 参数", () => {
  const state = { ...defaults, estimate: '{"monthlyRequests":1000}' };

  expect(serializeUrlState(defaults)).not.toContain("estimate=");
  expect(serializeUrlState(state)).not.toContain("estimate=");
  expect(parseUrlState("?estimate=%7B%22monthlyRequests%22%3A1000%7D")).toEqual(defaults);
});

it("在 popstate 时从当前 URL 恢复状态", () => {
  function UrlStateProbe() {
    const [state] = useUrlState(defaults);
    return createElement("output", null, state.query);
  }

  window.history.replaceState(null, "", "?q=first");
  render(createElement(UrlStateProbe));

  act(() => {
    window.history.replaceState(null, "", "?q=restored");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  expect(screen.getByRole("status")).toHaveTextContent("restored");
});

it("离散状态创建历史记录并支持真实后退与前进", async () => {
  function UrlHistoryProbe() {
    const [state, setState] = useUrlState(parseUrlState(window.location.search));
    return createElement(
      "div",
      null,
      createElement("output", null, state.currency),
      createElement("button", {
        type: "button",
        onClick: () => setState((current) => ({ ...current, currency: "USD" })),
      }, "切换美元"),
    );
  }

  window.history.replaceState(null, "", serializeUrlState(defaults));
  render(createElement(UrlHistoryProbe));
  fireEvent.click(screen.getByRole("button", { name: "切换美元" }));
  expect(window.location.search).toContain("currency=USD");

  act(() => window.history.back());
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("CNY"));

  act(() => window.history.forward());
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("USD"));
});

it("搜索替换当前记录，popstate 恢复时不再写历史", () => {
  function UrlHistoryProbe() {
    const [state, setState] = useUrlState(defaults);
    return createElement(
      "div",
      null,
      createElement("output", null, state.query),
      createElement("button", {
        type: "button",
        onClick: () => setState(
          (current) => ({ ...current, query: "gpt" }),
          { history: "replace" },
        ),
      }, "搜索"),
    );
  }

  window.history.replaceState(null, "", serializeUrlState(defaults));
  render(createElement(UrlHistoryProbe));
  const pushSpy = vi.spyOn(window.history, "pushState");
  const replaceSpy = vi.spyOn(window.history, "replaceState");

  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  expect(replaceSpy).toHaveBeenCalledOnce();
  expect(pushSpy).not.toHaveBeenCalled();

  pushSpy.mockClear();
  replaceSpy.mockClear();
  window.history.replaceState(null, "", "?q=restored&sort=input&direction=asc&currency=CNY");
  replaceSpy.mockClear();
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(screen.getByRole("status")).toHaveTextContent("restored");
  expect(pushSpy).not.toHaveBeenCalled();
  expect(replaceSpy).not.toHaveBeenCalled();

  pushSpy.mockRestore();
  replaceSpy.mockRestore();
});
