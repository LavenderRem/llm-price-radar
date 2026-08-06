# 设计 QA

- source visual truth path: `C:\Users\180841\.codex\generated_images\019fd511-05ba-7fd3-b298-2c9eb726f6f7\exec-e55e71a9-125a-4e87-82ab-aae187bb5ed7.png`
- implementation screenshot path: `D:\AI\Projects\llm-price\site\design\qa-desktop.png`
- viewport: `1440 × 1024` CSS px
- source pixels: `1487 × 1058`，按相同比例归一化为 `1440 × 1024`
- implementation pixels: `1440 × 1024`
- deviceScaleFactor: `1`
- state: 价格对比、CNY、已选 3 个模型
- full-view comparison evidence: `C:\Users\180841\AppData\Local\Temp\llm-price-design-qa-pass2.png`
- focused region comparison evidence: `C:\Users\180841\AppData\Local\Temp\llm-price-design-qa-focused-pass2.png`

## 必查表面

- 字体与排版：字号、行高和数字等宽风格接近参考；实现中的模型名略粗，归类为可接受的 P3 光学差异。
- 间距与布局节奏：桌面顶部、筛选行、主表与 280px 右栏结构匹配；对比栏已补齐参考月成本摘要，不再出现主要区域空置。
- 颜色与视觉 Token：白底、蓝色主操作、青色价格/选中态、浅灰边框与参考一致，未发现阻塞性对比度问题。
- 图像质量与资产保真：已从参考图提取透明产品标识与六个服务商 Logo，在桌面表格、移动摘要卡片和对比清单中复用；未再使用字母方块或通用图标替代。
- 文案与内容：主要导航、筛选、价格表、对比清单及参考月成本文案完整；实现明确标注参考用量，避免把价格优势解释为能力优势。

## 发现

- Pass 2 未发现仍需处理的 P0/P1/P2 差异。
- P3：实现中的模型名和右栏标题略粗于参考图；保留该差异以提升中文与英文混排下的扫描性。
- 可接受差异：参考图的月成本区包含可编辑输入框；实现将输入放在独立“成本估算”视图，右栏只显示明确标注 10M/5M 参考用量的摘要与入口，避免在紧凑栏重复完整表单。

## 对比历史

### Pass 1

- 先前发现：服务商 Logo 资产不匹配、右栏月成本摘要缺失、产品标识不匹配。
- 已完成修复：提取并接入产品/服务商透明位图；新增 10M 输入、5M 输出的逐模型参考月成本与最低月成本文字；保留成本估算和详情入口。
- 修复后证据：`C:\Users\180841\AppData\Local\Temp\llm-price-design-qa-pass2.png` 与 `C:\Users\180841\AppData\Local\Temp\llm-price-design-qa-focused-pass2.png`。

### Pass 2

- 复查结果：先前三项 P1/P2 均已解决。
- 桌面：完整表格、参考月成本和右侧清单保持同一首屏层级。
- 移动：`390 × 844` 摘要卡片使用真实 Logo；筛选通过全屏抽屉打开；底部对比入口不覆盖列表内容；无页面级横向滚动。
- 字体、间距、颜色、图像质量和文案五个必查表面均已完成复查。

## 实施清单

1. 已替换产品与服务商视觉资产。
2. 已为桌面对比栏补齐紧凑参考月成本摘要。
3. 已重新捕获 `1440 × 1024` 与 `390 × 844`，并复查字体、间距、颜色、图像与文案。

final result: passed
