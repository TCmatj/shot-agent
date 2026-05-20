import { FolderPlus, Image, MessageSquare, Play, Settings, Video } from 'lucide-react';
import { findProvidersForCanonicalModel } from '../domain/provider';
import type { ProviderConfig } from '../domain/provider';

const providers: ProviderConfig[] = [
  {
    id: 'provider_openai',
    name: 'OpenAI 官方',
    protocol: 'openai-compatible',
    baseURL: 'https://api.openai.com',
    apiTokenRef: 'secret_openai',
    enabled: true,
    models: [
      {
        providerModelId: 'gpt-image-2',
        canonicalModelId: 'gpt-image-2',
        enabled: true,
      },
    ],
  },
  {
    id: 'provider_seedance',
    name: '火山方舟',
    protocol: 'volcengine',
    baseURL: 'https://ark.cn-beijing.volces.com',
    apiTokenRef: 'secret_seedance',
    enabled: true,
    models: [
      {
        providerModelId: 'doubao-seedance-2-0-260128',
        canonicalModelId: 'seedance2.0',
        enabled: true,
      },
      {
        providerModelId: 'doubao-seedance-2-0-fast-260128',
        canonicalModelId: 'seedance2.0-fast',
        enabled: true,
      },
    ],
  },
];

const nodeTypes = [
  {
    id: 'gpt-image-2',
    label: 'gpt-image-2 图片节点',
    icon: Image,
  },
  {
    id: 'seedance2.0',
    label: 'seedance2.0 视频节点',
    icon: Video,
  },
  {
    id: 'chat-openai',
    label: '对话节点',
    icon: MessageSquare,
  },
];

export function App() {
  const imageProviders = findProvidersForCanonicalModel(providers, 'gpt-image-2');
  const videoProviders = findProvidersForCanonicalModel(providers, 'seedance2.0');

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header>
          <h1>shot-agent</h1>
          <p>无限画布视觉工作台</p>
        </header>
        <nav>
          <button type="button">
            <FolderPlus size={18} />
            新建画布
          </button>
          <button type="button">
            <Settings size={18} />
            供应商管理
          </button>
        </nav>
        <section className="panel">
          <h2>节点</h2>
          <div className="node-list">
            {nodeTypes.map((node) => {
              const Icon = node.icon;
              return (
                <button key={node.id} type="button">
                  <Icon size={18} />
                  {node.label}
                </button>
              );
            })}
          </div>
        </section>
      </aside>
      <section className="workspace">
        <div className="toolbar">
          <button type="button">
            <Play size={18} />
            全工作流执行
          </button>
        </div>
        <div className="canvas-preview">
          <article className="node-card">
            <h2>gpt-image-2</h2>
            <p>可用供应商：{imageProviders.map((provider) => provider.name).join('、')}</p>
            <textarea placeholder="输入提示词，使用 @image:asset_id 引用图片" />
            <button type="button">生成</button>
          </article>
          <article className="node-card">
            <h2>seedance2.0</h2>
            <p>可用供应商：{videoProviders.map((provider) => provider.name).join('、')}</p>
            <textarea placeholder="输入提示词，使用 @video:asset_id 引用视频" />
            <button type="button">生成</button>
          </article>
        </div>
      </section>
    </main>
  );
}
