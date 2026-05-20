import { FolderPlus, Settings, Workflow } from 'lucide-react';

export function App() {
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
            供应商
          </button>
        </nav>
      </aside>
      <section className="workspace">
        <div className="toolbar">
          <button type="button">
            <Workflow size={18} />
            工作流
          </button>
        </div>
        <div className="empty-canvas">
          <h2>准备开始创作</h2>
          <p>创建画布后，图片节点、视频节点和对话节点会在这里组织成工作流。</p>
        </div>
      </section>
    </main>
  );
}
