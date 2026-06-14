# 画布缩放性能优化（LOD + 资产懒加载）

> 作者：matijun　日期：2026-06-14　方法：systematic-debugging（性能根因）→ 优化方案

### 🎯 目标理解

- **现象**：150+ 节点、90+ 资产下，**缩小画面（zoom out）明显卡顿**。
- **约束**：
  - 不改变节点交互（选中、拖拽、编辑、生成）。
  - 选中 / 正在编辑 / 正在生成的节点始终保持全细节。
  - 浏览器 + 桌面双运行时一致。
  - 不引入 canvas 重写等大重构（第一期保持 DOM 渲染）。

### 🧠 分析与思考（根因）

- 项目**无 LOD**：缩小后视口范围（canvas 坐标 = 像素 / scale）变大，更多节点落入可见范围（150 节点很可能全可见），且每节点**全细节渲染**。
- 每节点 DOM 重：多个 `InlineOptionSelect` 配置、`PromptTextarea`（contenteditable 富文本）、输出预览、资产 `<img>`/`<video>`。
- 估算压力：150 节点 × ~80 DOM ≈ 12000+ 元素 + 90 个 media + 每节点一个合成层（`transform`/`will-change`）+ 每节点一个 `ResizeObserver` 目标 → **DOM 量 / 合成层 / media 解码 / 内存**四重压力。
- 结论：不是单节点慢，是「全细节 × 全节点」撑爆渲染。tldraw / Reactflow / Figma 都靠 LOD 解决。

### 📋 拟定计划（Artifact: Plan）

**A. LOD（细节层次）—— 主优化**

1. [ ] 新增常量 `LOD_LOW_DETAIL_THRESHOLD = 160`（节点在屏幕上的宽度 px 阈值，可调）。
2. [ ] 在节点渲染处（`App.tsx` article map）计算：
   - `nodeScreenWidth = getCanvasNodeWidth(node) * viewport.scale`
   - `isLowDetail = nodeScreenWidth < LOD_LOW_DETAIL_THRESHOLD`
   - **例外**：`selectedNodeIdSet.has(node.id)`（选中）、`editingNodeId`（编辑中）、`runningNodeIds.has(node.id)`（生成中）→ 强制 `isLowDetail = false`，保交互/反馈。
3. [ ] `CanvasNodeBody` 新增 `isLowDetail` prop：
   - `true` → 只渲染 header（图标 + 标题）+ 状态指示（生成中/失败色），**不渲染**配置下拉、PromptTextarea、输出预览、资产 media。
   - `false` → 现状全细节。
4. [ ] 简化模式下 article 的 `width`/`minHeight` 仍按 `getCanvasNodeWidth/Height`（保持定位与剔除一致），内部内容精简。
5. [ ] 验证：缩小到阈值下，节点变简化卡；选中节点立即恢复全细节；生成中节点保持状态可见。

**B. 资产 media 懒加载 —— 补充优化**

6. [ ] 资产/输出 `<img>` 加 `loading="lazy"`（原生懒加载，离屏不下载）。
7. [ ] `<video>`（资产预览）：全细节模式下用 `preload="none"` + poster 占位；仅在可见且 `nodeScreenWidth` 足够大时设置 `src`。
8. [ ] 可选：`IntersectionObserver`（root = canvas plane）对昂贵 media 精确控制，进一步降解码压力。

**C. 配套减负（低成本，建议顺带）**

9. [ ] `.canvas-node` 的 `contain` 由 `layout style` 加到 `layout style paint`（隔离重绘）。
10. [ ] LOD 简化模式下，article 不输出 `will-change: transform`（减少合成层），交互时再恢复。
11. [ ] LOD 简化模式停止该节点的 `ResizeObserver` observe（屏幕尺寸变化此时无意义），全细节恢复时重新 observe。

### 🚨 风险评估与回滚

- **风险**：
  - **阈值抖动**：节点屏幕宽在阈值附近，缩放时在「简化/全细节」间反复切换 → 节点高度跳变 → `ResizeObserver` 回调 → `measuredNodeHeights` 变 → `filterVisibleCanvasNodes` 重算 → 可能闪烁/抖动。
    - 缓解：**滞后阈值（hysteresis）**——进入简化用 160，退出用 200，避免边界震荡。
  - **选中态切换闪烁**：选中节点从简化切全细节，DOM 重建可能闪。
    - 缓解：选中节点强制全细节（步骤2），切换时节点已聚焦，闪烁可接受；必要时过渡。
  - **资产懒加载与 LOD 叠加**：LOD 简化模式已不渲染 media，B 主要作用于全细节 + 离屏；两者不冲突。
  - **`contain: paint`** 可能裁剪溢出元素（如 resize handle 在 `bottom:-8px` 外）——需验证 handle/edge-handle 不被裁剪，必要时只在简化模式加 paint。
  - **桌面 WebView**：`loading="lazy"` 与 `IntersectionObserver` 均支持，但需在 Tauri 实测。
- **回滚**：LOD 由 `isLowDetail` 计算 + prop 控制；回滚 = 把 `isLowDetail` 恒置 `false`（一行），其他改动惰性化。`contain`/`will-change`/`loading=lazy` 均为可回退的渐进增强。单提交 `git revert`。

### Code Review（模拟苛刻审查）

- ⚠️ **LOD 阈值用屏幕宽 vs scale**：用屏幕宽更准确（节点宽不同），但需每节点算 `getCanvasNodeWidth * scale`；可 memo 化。确保 viewport 变化时重算（依赖 viewport.scale）。
- ⚠️ **简化模式的剔除高度**：简化模式实际 DOM 高度变小，但视口剔除用 `measuredNodeHeights`（实测）。简化/全细节切换高度变 → measuredHeights 变 → 可能影响剔除准确性。需确认简化模式高度稳定或剔除对其不敏感。
- ⚠️ **`PromptTextArea` 懒挂载（若做）**：卸载 contenteditable 会丢失未提交的编辑态/光标——本期**不做** C 的 contenteditable 懒挂载，仅 LOD 隐藏（选中恢复），避免丢输入。
- ⚠️ **合成层**：150 合成层是 GPU 内存大头。LOD 简化模式去 `will-change` 可减合成层，但 `transform: translate3d` 仍创建合成层（定位需要）——折中，不完全消除。
- ✅ LOD 是行业标准方案，风险可控。
- ✅ 选中/生成中豁免保证交互与反馈不受影响。

### ❓ 待确认问题

1. LOD 阈值：屏幕宽 **160px**（推荐）合适，还是另定？是否要滞后（160 进 / 200 出）？
2. 是否做 C 的配套减负（contain/will-change/observer），还是先只做 A+B 验证效果？
3. 资产 media：img 用原生 `loading="lazy"` 够，还是要 `IntersectionObserver` 精确控制（video 需要后者）？
