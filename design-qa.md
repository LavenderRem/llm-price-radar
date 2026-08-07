# 设计 QA

- source visual truth path: `site/design/reference-option-1.png`
- implementation screenshot path: `site/design/qa-desktop.png`
- viewport: `1440 × 1024` CSS px
- source pixels: `1487 × 1058`，按相同比例归一化为 `1440 × 1024`
- implementation pixels: `1440 × 1024`
- deviceScaleFactor: `1`
- state: 价格对比、CNY、已选 3 个模型
- full-view comparison evidence: `site/design/qa-comparison-desktop.png`（左侧为归一化参考图，右侧为实现图，`2882 × 1024`）
- focused region comparison evidence: `site/design/qa-comparison-focused.png`（左右同序，聚焦首屏上方 `680px` 的导航、筛选、Logo、表头和对比栏）

## 必查表面

- 字体与排版：字号、行高和数字等宽风格接近参考；实现中的模型名略粗，归类为可接受的 P3 光学差异。
- 间距与布局节奏：桌面顶部、筛选行、主表与 280px 右栏结构匹配；对比栏已补齐参考月成本摘要，不再出现主要区域空置。
- 颜色与视觉 Token：白底、蓝色主操作、青色价格/选中态、浅灰边框与参考一致；键盘焦点环使用不透明 `#1f6feb` 3px 描边，对白色和选中浅底的对比度分别为 `4.634:1` 与 `4.473:1`，高于非文本焦点指示所需的 `3:1`。
- 图像质量与资产保真：已从参考图提取透明产品标识与六个服务商 Logo，在桌面表格、移动摘要卡片和对比清单中复用；Logo 展示框从 36px 收敛到参考设计接近的 24px，40–46px 位图保持接近 2x 密度，未出现裁切或加载失败。
- 文案与内容：主要导航、筛选、价格表、对比清单及参考月成本文案完整；实现明确标注参考用量，避免把价格优势解释为能力优势。

## 发现

- Pass 2 未发现仍需处理的 P0/P1/P2 差异。
- P3：实现中的模型名和右栏标题略粗于参考图；保留该差异以提升中文与英文混排下的扫描性。
- 可接受差异：参考图的月成本区包含可编辑输入框；实现将输入放在独立“成本估算”视图，右栏只显示明确标注 10M/5M 参考用量的摘要与入口，避免在紧凑栏重复完整表单。

## 对比历史

### Pass 1

- 先前发现：服务商 Logo 资产不匹配、右栏月成本摘要缺失、产品标识不匹配。
- 已完成修复：提取并接入产品/服务商透明位图；新增 10M 输入、5M 输出的逐模型参考月成本与最低月成本文字；保留成本估算和详情入口。
- 修复后证据：已重新生成到项目内的 `site/design/qa-comparison-desktop.png` 与 `site/design/qa-comparison-focused.png`。

### Pass 2

- 复查结果：先前三项 P1/P2 均已解决。
- 桌面：完整表格、参考月成本和右侧清单保持同一首屏层级。
- 移动：`390 × 844` 摘要卡片使用真实 Logo；筛选通过全屏抽屉打开；底部对比入口不覆盖列表内容；无页面级横向滚动。
- 字体、间距、颜色、图像质量和文案五个必查表面均已完成复查。

### Pass 3（最终复核）

- 先前发现：通用控件及分段选项的半透明焦点环低于 `3:1`；服务商 Logo 的 36px 展示密度高于参考图约 24px；Pass 2 同图证据位于临时目录，无法随项目交付。
- 已完成修复：焦点环改为不透明 3px `var(--primary)`；Logo 统一收敛为 24px、模型身份列调整为 28px；参考图及 full/focused 同图对照全部保存到 `site/design/`。
- 修复后证据：`site/design/qa-comparison-desktop.png` 与 `site/design/qa-comparison-focused.png`；桌面和移动实现分别见 `site/design/qa-desktop.png`、`site/design/qa-mobile.png`。
- 复查结果：1440、1024、390 三视口无横向溢出，24px Logo 无裁切，移动卡片与固定 CTA 无重叠；焦点环计算样式为不透明主色、solid、3px。

## 实施清单

1. 已替换产品与服务商视觉资产。
2. 已为桌面对比栏补齐紧凑参考月成本摘要。
3. 已重新捕获 `1440 × 1024` 与 `390 × 844`，并复查字体、间距、颜色、图像与文案。
4. 已修正键盘焦点对比度和 Logo 密度，并将 Pass 2/3 同图证据迁入项目目录。

### Pass 4（图稿复刻修正）

- 比对视口：`1488 × 1058` CSS px，`deviceScaleFactor: 1`；状态为价格对比、CNY、已选 3 个模型。
- 参考图：`site/design/reference-option-1.png`（`1487 × 1058`）；实现截图：`C:\Users\180841\AppData\Local\Temp\llm-price-replica-final.png`（`1488 × 1058`）。
- 全视图证据：筛选栏、主表格和右侧对比栏均按同一首屏状态比对；重点区域为导航、筛选栏、对比卡片和月成本估算区。
- 已修复：桌面筛选栏的列宽、分隔线、模型类型选项和主表顶部节奏；右栏对比卡片、参考用量输入、成本汇总、清空操作和底部按钮的结构与垂直节奏。
- 必查表面：字体与排版、间距与布局、颜色 Token、Logo 资源与文案均已复查；所有品牌标识均继续使用位图资产。
- 剩余可接受差异：模型名称与价格使用当前目录数据，未回退为参考图中的示例数据；因此数值内容不同，但布局、层级、控件尺寸和视觉语言保持一致。
- 运行检查：无页面错误、无横向溢出；`npm test -- --run` 通过 `156` 项，`npm run build` 通过。

### Pass 5（控件与选中态）

- 用户截图复现：服务商与模型类型的选中项缺少完整下边框；已选表格行的下边框被单元格边线遮挡，且两端为直角。
- 根因：分段控件的内阴影被容器裁切；行级 `tr` 描边处于单元格背景和边框之下。
- 修复：中文 UI 字体改为优先使用 `Microsoft YaHei UI`；选中分段控件使用独立的 `1.5px` 完整描边与 `6px` 圆角；已选表格行将四边描边下沉到 `td`，首尾单元格采用 `8px` 圆角。
- 复核截图：`C:\Users\180841\AppData\Local\Temp\llm-price-control-fix.png`，`1488 × 1058`、`deviceScaleFactor: 1`；选中分段和三条已选模型行均显示完整边框和圆角，无横向溢出或控制台错误。
- 回归：`npm test -- --run` 通过 `156` 项；`npm run build` 通过。

final result: passed
