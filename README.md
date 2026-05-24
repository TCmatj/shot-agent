<p align="center">
  <img src="public/shot-agent-logo.svg" alt="shot-agent logo" width="124" />
</p>

<h1 align="center">shot-agent</h1>

<p align="center">一个干净简洁的 AI 图像与视频工作流画布。</p>

<p align="center">
  中文
  |
  <a href="README.en.md">English</a>
  |
  <a href="#浏览器版">浏览器版</a>
  |
  <a href="#桌面版">桌面版</a>
  |
  <a href="#当前能力">当前能力</a>
  |
  <a href="#开源协议">许可证</a>
</p>

`shot-agent` 旨在提供一个干净、简洁的无限画布，用于视觉创作。

项目会逐步接入主流图片生成模型和视频生成模型，让用户可以在一个开放工作区中创建、摆放、对比和迭代生成素材。

## 路线图

第一期重点接入：

- `gpt-image-2`
- `seedance2.0`
- `seedance2.0-fast`

## 当前能力

- React + TypeScript + Vite 应用骨架
- 黑色格点无限画布界面
- 节点拖拽、画布平移与缩放
- 默认打开首个画布，左侧展示画布列表
- 左侧边栏可折叠
- 左侧画布列表支持就地重命名和删除
- 画布列表标题右侧提供小型 `+` 新建画布按钮
- 画布允许全部删除，删除干净后显示空状态
- 画布新建、重命名、删除、导入和导出
- 画布名称右侧铅笔按钮支持就地重命名
- 画布内左侧悬浮工具组支持新建、导出和导入画布
- 画布内通过 `+` 或右键菜单添加节点
- 连线拖到空白处可直接创建并连接新节点
- 文本、图片、视频资产节点，仅作为输出节点
- 图片资产支持导入、拖入和粘贴创建
- 视频资产支持导入和拖入创建
- 拖拽节点连接点创建画布节点连线
- 选中连线后删除连线
- 选中节点后查看节点详情与配置入口
- 选中节点或连线后支持键盘 `Delete` / `Backspace` 删除
- 浏览器本地保存画布列表、当前画布和节点位置
- 支持自定义画布存储文件夹配置，浏览器支持时可直接选择文件夹
- 画布项目领域模型
- 工作流节点与连线领域操作
- 供应商配置与模型映射
- 供应商管理视图，进入后替换画布区域，一行一个供应商
- 模型映射清晰区分供应商模型 ID 与映射后标准模型 ID
- 供应商支持删除，删除后从配置列表完全移除
- 提示词 `@` 引用解析
- 生成历史与重试规则
- 本地画布存储接口

## 设计方向

- 黑色主视觉与格点画布
- 图片、视频、对话与资产节点统一工作区
- 浏览器与桌面双运行时
- 模型供应商、模型映射与本地文件工作区

## 环境准备

建议使用：

- `Node.js 20+`
- `npm 10+`

桌面版额外需要：

- `Rust` 与 `cargo`
- macOS 下可直接使用：

```bash
curl https://sh.rustup.rs -sSf | sh -s -- -y
source ~/.cargo/env
```

安装项目依赖：

```bash
npm install
```

## 浏览器版

本地开发：

```bash
npm run dev
```

默认会启动 Vite 开发服务器。启动后在浏览器中打开终端输出的本地地址即可。

生产构建：

```bash
npm run build
```

构建产物输出到：

```text
dist/
```

## 桌面版

本地开发：

```bash
source ~/.cargo/env
npm run desktop:dev
```

该命令会先启动前端开发服务器，再以 Tauri 桌面窗口方式运行应用。

桌面构建：

```bash
source ~/.cargo/env
npm run desktop:build
```

构建完成后，可在以下目录找到桌面产物：

```text
src-tauri/target/release/
src-tauri/target/release/bundle/
```

macOS 本地安装可直接打开：

```text
src-tauri/target/release/bundle/macos/shot-agent.app
```

若构建出 DMG，也可通过 `bundle/dmg/` 下的安装包分发。

## 开源协议

本项目使用 GNU General Public License v3.0 only 开源协议。详情见 [LICENSE](LICENSE)。
