# Claude Skills（项目级）

本目录是 `shot-agent` 项目级 Claude Code skill 集合，位于 `.claude/skills/`。Claude Code 在本仓库工作时会自动加载这些 skill。

共 17 个 skill，分两类来源。

## 项目自有 skill（3 个）

与仓库内 `.agents/skills/` 内容一致，供 Codex 等其他 agent 与 Claude 共用。

- `auto-code-review`
- `commit-message-standard`
- `pull-request-standard`

## 第三方 skill：Superpowers（14 个）

| 项 | 值 |
|----|----|
| 来源 | https://github.com/obra/superpowers |
| 版本 | commit `6fd4507` |
| 许可 | MIT（见同目录 `superpowers-LICENSE.txt`） |
| 作者 | Jesse Vincent |

包含：

- `brainstorming`
- `dispatching-parallel-agents`
- `executing-plans`
- `finishing-a-development-branch`
- `receiving-code-review`
- `requesting-code-review`
- `subagent-driven-development`
- `systematic-debugging`
- `test-driven-development`
- `using-git-worktrees`
- `using-superpowers`
- `verification-before-completion`
- `writing-plans`
- `writing-skills`

## 维护说明

- **同步**：项目自有 skill 在 `.agents/skills/` 与 `.claude/skills/` 各存一份，改动需同步两处。
- **升级 superpowers**：重新克隆 `obra/superpowers`，用其 `skills/` 下对应 14 个子目录覆盖本目录，并更新本文件的 commit 号。
- **范围**：本次仅纳入 superpowers 的 `skills/`；其 plugin 级 `hooks/`、`scripts/` 未引入。`using-superpowers` 的会话级自动注入依赖 SessionStart hook，未配置 hook 时需手动 `/using-superpowers` 调用。
