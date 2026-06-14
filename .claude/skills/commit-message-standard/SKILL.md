---
name: commit-message-standard
description: 当需要为本项目创建、改写、检查或建议 git commit message 时使用，尤其适用于提交代码前、用户要求提交变更时，或需要确认提交说明是否符合项目规范时。
---

# 代码提交规范

## 核心规则

commit message 使用英文类型前缀和中文说明。每个 commit 应聚焦一个逻辑变更，便于 review 和回溯。

## 格式

使用以下格式：

```text
<type>: <中文简短说明>
```

需要补充细节时，空一行后添加正文：

```text
<type>: <中文简短说明>

<补充说明，说明为什么改、影响范围、验证方式>
```

## 类型

- `feat`：新增功能、页面、组件、接口、能力
- `fix`：修复缺陷、异常、回归问题
- `doc`：README、注释、规范、说明文档
- `refactor`：不改变行为的代码结构调整
- `perf`：性能优化
- `test`：新增或调整测试
- `build`：依赖、构建产物、打包配置
- `ci`：CI/CD、自动化流程、发布配置
- `style`：格式、样式、排版调整，不影响逻辑
- `chore`：工具、脚本、仓库维护、杂项清理
- `revert`：回滚已有变更

## 编写要求

- `type` 使用上方固定英文分类，小写。
- 冒号使用英文半角冒号，冒号后保留一个空格。
- 简短说明使用中文，建议控制在 50 个汉字以内。
- 描述变更内容，不描述执行了什么命令。
- 使用祈使句或结果导向表达。
- 避免 `update`、`修改文件`、`fix bug`、`wip` 这类模糊说明。
- 不要在一个 commit 中混入无关变更。
- 如果 README 有变更，确认 `README.md` 和 `README.en.md` 已同步更新。
- 提交前检查 `git status --short`，并查看已暂存文件的 diff。

## 示例

推荐：

```text
doc: 拆分中英文 README
```

```text
chore: 添加 GPLv3 许可和基础说明
```

```text
feat: 接入 gpt-image-2 图片生成入口
```

```text
fix: 修复画布元素拖拽丢失焦点问题
```

避免：

```text
update
```

```text
修改 README
```

```text
wip
```

```text
fix: bug
```
