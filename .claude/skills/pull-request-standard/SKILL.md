---
name: pull-request-standard
description: 当需要为本项目准备、创建、检查或更新 Pull Request 时使用，尤其适用于用户要求创建 PR、编写 PR 描述、推送分支进入 review，或确认 PR 是否已准备好时。
---

# Pull Request 规范

## 核心规则

每个 PR 都应说明改了什么、为什么改、如何验证，以及仍有哪些风险。除非目标仓库明确要求英文，否则 PR 使用中文编写。

## PR 标题

使用与 commit 相同的类型词：

```text
<type>: <中文简短说明>
```

示例：

```text
doc: 拆分中英文 README
feat: 接入 seedance2.0 视频生成
fix: 处理画布元素拖拽丢失焦点
```

## PR 描述模板

使用以下结构：

```markdown
## 变更内容

- 

## 变更原因

- 

## 验证方式

- 

## 影响范围

- 

## 风险与回滚

- 
```

## 提交前检查清单

创建或更新 PR 前，确认：

- 当前分支只包含相关变更。
- 已运行与变更最相关的验证命令。
- 已检查 `git diff` 或 PR diff，确认没有误提交文件、密钥、调试日志和无关改动。
- 如果 README 有变更，已同步更新 `README.md` 和 `README.en.md`。
- commit message 使用英文类型前缀和中文说明，并符合 `commit-message-standard`。
- 重要 UI 变更尽量附截图或录屏。
- 如有无法运行的验证，需要说明原因。

## Review 回复要求

- 将 review 反馈视为需要理解的需求，不要盲目照做。
- 当反馈含糊或与项目目标冲突时，先澄清。
- 应用 review 反馈后，说明改了什么以及如何验证。
- 后续补充 commit 保持聚焦，并继续使用中文 commit message。
