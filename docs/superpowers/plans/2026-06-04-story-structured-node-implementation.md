# Story Structured Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有无限画布中接入 `story` 故事拆解节点，先完成节点骨架、结构化结果存储、基础生成链路和受限输入规则。

**Architecture:** 新增独立 `story` 节点类型，但第一阶段复用现有对话节点的语言模型调用链路。画布层负责节点类型、连线限制和基础详情面板；领域层负责故事结构化数据类型；模型层把 `story` 视作文本生成节点处理，为后续自动展开下游图片/视频节点预留数据位。

**Tech Stack:** TypeScript、React、Vite、Vitest

---

### Task 1: 故事节点类型与连接规则

**Files:**
- Create: `src/domain/story.ts`
- Modify: `src/app/canvasWorkspace.ts`
- Test: `test/unit/canvasWorkspace.test.ts`

- [ ] 为故事节点补失败测试：可接收输入，但拒绝视频和音频输入
- [ ] 新增故事节点结构类型与默认配置
- [ ] 将 `story` 纳入画布节点类型与连线规则

### Task 2: 画布节点模板与详情面板

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.css`
- Test: `test/unit/App.test.tsx`

- [ ] 为故事节点补失败测试：可从添加菜单创建，并在详情中显示故事专用提示词占位文案
- [ ] 在添加节点菜单中加入故事节点
- [ ] 让故事节点复用对话类供应商和模型选择 UI
- [ ] 将故事节点提示词输入限制为文本/图片引用语义

### Task 3: 故事节点生成链路

**Files:**
- Modify: `src/models/generationClient.ts`
- Modify: `src/app/App.tsx`
- Test: `test/unit/generationClient.test.ts`

- [ ] 为故事节点补失败测试：按文本生成请求构建 OpenAI / Anthropic 请求
- [ ] 让故事节点复用流式文本生成链路
- [ ] 将故事节点输出保存为文本结果，并写入结构化结果占位字段

### Task 4: 基础持久化与验证

**Files:**
- Modify: `src/app/canvasWorkspace.ts`
- Test: `test/unit/canvasWorkspace.test.ts`

- [ ] 为故事节点结构化字段补持久化测试
- [ ] 确认工作区序列化 / 反序列化不丢失故事节点数据
- [ ] 运行相关单测与 `npm run lint`
