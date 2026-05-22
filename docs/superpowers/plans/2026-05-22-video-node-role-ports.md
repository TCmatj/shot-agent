# Video Node Role Ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让视频节点左侧按模式显示首帧图、尾帧图、文本、视频、音频等独立输入圆点，并让连线和 Seedance 请求按端口角色稳定映射。

**Architecture:** 在画布连线数据结构中增加目标端口标识，视频节点根据当前模式声明可见输入端口。画布渲染、连线校验和 Seedance 请求体都统一读取端口角色，而不是再依赖节点级单输入口或图片顺序推断。

**Tech Stack:** TypeScript、React、Vite、Vitest

---

### Task 1: 扩展边数据与端口定位

**Files:**
- Modify: `src/app/canvasWorkspace.ts`
- Test: `test/unit/canvasWorkspace.test.ts`

- [ ] 新增边的 `toPortId` 字段和输入端口坐标辅助函数
- [ ] 为 `createCanvasEdge` / `addCanvasEdge` / `getNodeInputPoint` 相关能力补测试

### Task 2: 视频节点左侧角色端口 UI

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.css`
- Test: `test/unit/App.test.tsx`

- [ ] 先写失败测试，描述模式切换后应显示的端口集合
- [ ] 将视频节点左侧改成多输入圆点和标签
- [ ] 统一节点内外模式下拉样式
- [ ] 切换模式后清理不再可用的端口连线

### Task 3: Seedance 端口映射与限制

**Files:**
- Modify: `src/models/generationClient.ts`
- Test: `test/unit/generationClient.test.ts`

- [ ] 先写失败测试，描述首帧图、尾帧图、多模态图片/视频端口如何映射到请求体
- [ ] 改为按 `toPortId` 收集视频节点输入
- [ ] 保持文本 prompt 与多模态素材角色一致

### Task 4: 验证与开发服务

**Files:**
- Modify: `src/app/App.tsx`

- [ ] 停掉 `5174`
- [ ] 释放并改用 `5173` 启动开发服务
- [ ] 运行类型检查与全量测试
- [ ] 在浏览器中验证视频节点端口与模式交互
