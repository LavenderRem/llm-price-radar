import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("关键视觉 Token", () => {
  it("为通用控件和分段选项提供不透明的 3px 主色焦点环", () => {
    expect(styles).toMatch(
      /button:focus-visible,[\s\S]*?a:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--primary\)/,
    );
    expect(styles).toMatch(
      /\.segment-option:has\(input:focus-visible\)\s*\{[^}]*outline:\s*3px solid var\(--primary\)/,
    );
  });

  it("将服务商 Logo 以 24px 框展示，并保留独立文本列", () => {
    expect(styles).toMatch(
      /(?:^|\n)\.provider-logo\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/,
    );
    expect(styles).toMatch(
      /\.model-identity\s*\{[^}]*grid-template-columns:\s*28px minmax\(0, 1fr\);/,
    );
    expect(styles).toMatch(
      /\.comparison-selection-list \.provider-logo\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/,
    );
  });
});
