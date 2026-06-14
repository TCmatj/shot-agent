import { isTauriRuntime } from '../storage/runtime';

// 运行时感知的 fetch：
// - 桌面（Tauri）：走 @tauri-apps/plugin-http（Rust reqwest + rustls-tls），绕过 WebView 的
//   CORS / TLS 栈，使 Windows(WebView2) 与 Mac(WKWebView) 行为一致，避免「failed to fetch」；
// - 浏览器：维持 window.fetch。
// 模块级缓存桌面 fetcher，避免每次调用重复动态 import。
let desktopFetcher: typeof fetch | null = null;

async function resolveRuntimeFetcher(): Promise<typeof fetch> {
  if (isTauriRuntime()) {
    if (!desktopFetcher) {
      const tauriHttp = await import('@tauri-apps/plugin-http');
      desktopFetcher = tauriHttp.fetch as unknown as typeof fetch;
    }
    return desktopFetcher;
  }

  return fetch;
}

export const runtimeFetch: typeof fetch = async (input, init) => {
  const fetcher = await resolveRuntimeFetcher();
  return fetcher(input, init);
};
