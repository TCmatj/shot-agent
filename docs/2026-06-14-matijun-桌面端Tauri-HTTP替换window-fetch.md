# 治本：桌面端用 Tauri HTTP 替换 window.fetch，解决 Windows「failed to fetch」

> 作者：matijun　日期：2026-06-14　调试方法：systematic-debugging（根因调查）

### 🎯 目标理解

- **现象**：Windows（WebView2）生成图片偶发 `failed to fetch`；Mac（WKWebView）正常。
- **根因**：`generationClient.ts` 用 `window.fetch`（`fetcher = input.fetcher ?? fetch`，行 456/496/568）在 WebView 内直连第三方供应商 API，请求带 `Authorization`（必然触发 CORS preflight）。CORS / TLS / origin 行为**完全取决于 WebView 实现**：
  - Tauri v2 production origin：Windows `https://tauri.localhost` vs Mac `tauri://localhost`（scheme 不同）；
  - TLS 栈：Windows Schannel vs Mac Secure Transport；
  - WebView2 对 custom-protocol origin 的 CORS 比 WKWebView 严格。
  → 跨平台行为分化，Windows 易在网络层被终止，浏览器吞掉细节只报 `failed to fetch`。
- **目标**：桌面端请求改由 **Rust 侧发出**（绕过 WebView 的 CORS/TLS 栈），浏览器端维持 `window.fetch`；双运行时行为一致；补齐超时（项目规范要求网络调用含超时/熔断）。

### 🧠 分析与思考

- **天然分流点**：`generationClient` / `providerModelList` / `objectStorage` 已有 `input.fetcher ?? fetch` 注入机制，无需重构传输层，只需在调用处注入「运行时感知 fetcher」。
- **桌面方案**：`@tauri-apps/plugin-http` 的 `fetch`，底层 `reqwest` + `rustls-tls`（**Cargo 已有 reqwest rustls-tls 依赖**），不经 WebView → 绕过 CORS，且 TLS 用 rustls 跨平台一致（消除 Schannel 差异，对应嫌疑③）。
- **浏览器方案**：无 Tauri plugin，维持 `window.fetch`（原行为）。
- **运行时检测**：`isTauriRuntime()`（`src/storage/runtime.ts:8`）已存在。
- **capabilities**：`plugin-http` 默认禁止所有 origin，需 scope glob；用户 `baseURL` 动态 → 用 `https://**` 覆盖（见下方 WebSearch 结论）。
- **并发/副作用**：纯前端 fetcher 注入 + Rust plugin 注册，无共享可变状态；reqwest/rustls 线程安全。无后端、无存储 schema 变更。

### 📋 拟定计划（Artifact: Plan）

1. [ ] 加依赖：`src-tauri/Cargo.toml` 增 `tauri-plugin-http = "2"`；`package.json` 增 `@tauri-apps/plugin-http`。
2. [ ] 注册 plugin：`src-tauri/src/lib.rs`（或 `main.rs`）的 builder 链 `.plugin(tauri_plugin_http::init())`。
3. [ ] `capabilities/default.json` 增 http 权限 + scope（`{ "identifier": "http:default", "allow": [{ "url": "https://**" }] }`，按需追加 `http://**`）。
4. [ ] 新建运行时感知 fetcher（建议 `src/models/httpFetch.ts`）：
   - `isTauriRuntime()` 为真 → 动态 `import('@tauri-apps/plugin-http')` 取 `fetch`，外包 **timeout**（`AbortSignal.timeout(ms)` 或 reqwest timeout），统一返回 `Response`；
   - 否则返回 `window.fetch`。
5. [ ] 注入 fetcher：`App.tsx` 的 `submitGenerationNode`（8850）、`queryGenerationTask`（8587）传入 `fetcher`；`providerModelList`、`objectStorage` 按范围决策一并注入。
6. [ ] 验证：Windows + Mac 桌面生成图片/视频不再 `failed to fetch`；浏览器模式 fallback 正常；`npm run lint && npm test && npm run build` + 桌面 `cargo build`。

### 🚨 风险评估与回滚

- **风险**：
  - `plugin-http` 的 `fetch` 与 `window.fetch` 的 `Response`/`Headers`/`body` 处理存在差异；`generationClient` 用到 **JSON / FormData / multipart（`/images/edits` 含图片 blob）**，需确认 plugin-http 对 `FormData` 的桥接（reqwest 支持 multipart，但 JS→Rust 的 FormData 传递需验证）。
  - capabilities scope `https://**` 过宽（桌面本地应用，SSRF 风险有限，但需明确接受）；若追加 `http://**` 则放弃混合内容保护。
  - 自签/私有证书 endpoint：rustls 默认 webpki roots，自签需额外配置（多数公有供应商 API 不受影响）。
  - 超时值：图片生成较慢，过短误杀；需分级（图/视频/任务查询/模型列表）。
  - Cargo 构建时间增加。
- **回滚**：fetcher 注入是可选（默认 fallback `window.fetch`）；回滚 = 调用处移除 `fetcher` 参数 + 撤销 plugin 注册/capability。单提交 `git revert` 即可；无数据/存储变更。

### Code Review（模拟苛刻审查）

- ⚠️ **scope `https://**`** 等于允许任意 https——需评估是否按用户已配置 baseURL 收敛（但 baseURL 动态、且可在运行时改，收敛成本高）。
- ⚠️ **http baseURL**：若允许 `http://**`，混合内容保护失效；建议优先引导用户使用 https baseURL（`normalizeBaseURL` 可选升级），但私有 http 部署需保留。
- ⚠️ **FormData/multipart**：`/images/edits` 的图片上传在 plugin-http 下的兼容性是最大技术风险点，实现时必须实测。
- ⚠️ **plugin-http fetch 超时**：`AbortSignal.timeout` 在 plugin-http 的支持需确认；否则在 Rust 侧 / 包一层 `Promise.race` 超时。
- ✅ reqwest rustls-tls 已在依赖，TLS 跨平台一致（治嫌疑③）。
- ✅ 绕过 WebView CORS（治嫌疑①②）。
- ✅ 浏览器 fallback 不变，无双运行时回归。

### ❓ 待确认问题

1. **capabilities scope**：接受 `https://**`（任意 https），还是收敛？是否需要 `http://**`（私有部署）？
2. **实现范围**：仅 `generationClient`（最小止血），还是一并覆盖 `providerModelList`、`objectStorage`（一致性）？
3. **超时策略**：图片生成 / 视频提交 / 任务查询 / 模型列表分别多少秒？（建议：图 120s、视频提交 60s、任务查询 30s、列表 15s）
4. `plugin-http` 的 FormData/multipart + Response 读取兼容性，**实现阶段用 Context7 查官方文档**逐项确认。

### 参考

- [HTTP Client – Tauri v2 官方文档](https://v2.tauri.app/plugin/http-client/)
- [plugin-http JavaScript API Reference](https://v2.tauri.app/reference/javascript/http/)
- [GitHub Issue #1559: url not allowed on the configured scope](https://github.com/tauri-apps/plugins-workspace/issues/1559)
