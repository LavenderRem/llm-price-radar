import { createElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { parseUrlState, serializeUrlState } from "../src/domain/urlState.js";
import { useUrlState } from "../src/hooks/useUrlState.js";

const defaults = {
  query: "",
  providers: [],
  capabilities: [],
  minContext: 0,
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
