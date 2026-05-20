# shot-agent MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable `shot-agent` MVP: a React + TypeScript app with local canvas project management, provider/model mapping, workflow node data, generation history, and storage abstractions ready for image/video model adapters.

**Architecture:** Start with a Vite React app and keep domain logic independent from UI. Persist each canvas as a folder with JSON metadata, workflow snapshots, prompt history, generation history, and asset directories. Keep provider config, model mapping, execution state, and storage adapters in focused modules so real model calls can be added behind stable interfaces.

**Tech Stack:** TypeScript, React, Vite, Vitest, React Testing Library, local file-system abstraction, future tldraw or canvas library integration.

---

## File Structure

Create these files:

```text
package.json
index.html
vite.config.ts
tsconfig.json
tsconfig.node.json
src/main.tsx
src/app/App.tsx
src/app/App.css
src/domain/types.ts
src/domain/canvasProject.ts
src/domain/provider.ts
src/domain/workflow.ts
src/domain/promptReferences.ts
src/domain/generationHistory.ts
src/storage/pathUtils.ts
src/storage/localCanvasStore.ts
src/storage/assetStore.ts
src/models/providerRegistry.ts
test/unit/canvasProject.test.ts
test/unit/provider.test.ts
test/unit/promptReferences.test.ts
test/unit/generationHistory.test.ts
test/fixtures/sampleCanvas.ts
```

Modify these files:

```text
.gitignore
README.md
README.en.md
```

## Task 1: Scaffold Vite React TypeScript App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.css`
- Modify: `.gitignore`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json`:

```json
{
  "name": "shot-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc -b --pretty false"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create Vite entry files**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>shot-agent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/App.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Create TypeScript and Vite config**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
```

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create minimal app UI**

Create `src/app/App.tsx`:

```tsx
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
```

Create `src/app/App.css`:

```css
:root {
  color: #172026;
  background: #f5f7f8;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

body {
  margin: 0;
}

button {
  align-items: center;
  background: #ffffff;
  border: 1px solid #d9e1e5;
  border-radius: 6px;
  color: #172026;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: #ffffff;
  border-right: 1px solid #d9e1e5;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
}

.sidebar h1 {
  font-size: 22px;
  margin: 0 0 4px;
}

.sidebar p {
  color: #65747d;
  margin: 0;
}

.sidebar nav {
  display: grid;
  gap: 10px;
}

.workspace {
  display: grid;
  grid-template-rows: 56px 1fr;
}

.toolbar {
  align-items: center;
  background: #ffffff;
  border-bottom: 1px solid #d9e1e5;
  display: flex;
  padding: 0 16px;
}

.empty-canvas {
  align-content: center;
  display: grid;
  justify-items: center;
  padding: 32px;
  text-align: center;
}

.empty-canvas h2 {
  font-size: 28px;
  margin: 0 0 8px;
}

.empty-canvas p {
  color: #65747d;
  margin: 0;
  max-width: 520px;
}
```

- [ ] **Step 5: Extend `.gitignore`**

Append these entries:

```gitignore
# Vite
.vite/

# Test output
test-results/
playwright-report/
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 7: Verify scaffold**

Run: `npm run lint`

Expected: TypeScript exits 0.

Run: `npm run build`

Expected: Vite build exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src .gitignore
git commit -m "feat: 搭建前端应用骨架"
```

## Task 2: Define Domain Types

**Files:**
- Create: `src/domain/types.ts`
- Create: `test/fixtures/sampleCanvas.ts`
- Test: `test/unit/canvasProject.test.ts`

- [ ] **Step 1: Write failing type behavior tests**

Create `test/unit/canvasProject.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createCanvasProject } from '../../src/domain/canvasProject';

describe('createCanvasProject', () => {
  it('creates a canvas with a stable id, name, and folder layout', () => {
    const project = createCanvasProject({
      name: '测试画布',
      rootDir: '/tmp/shot-agent-demo',
      now: '2026-05-20T00:00:00.000Z',
      id: 'canvas_abc123',
    });

    expect(project.id).toBe('canvas_abc123');
    expect(project.name).toBe('测试画布');
    expect(project.rootDir).toBe('/tmp/shot-agent-demo');
    expect(project.paths.workflow).toBe('workflow.json');
    expect(project.paths.assets.images).toBe('assets/images');
    expect(project.createdAt).toBe('2026-05-20T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/unit/canvasProject.test.ts`

Expected: FAIL because `src/domain/canvasProject.ts` does not exist.

- [ ] **Step 3: Define shared domain types**

Create `src/domain/types.ts`:

```ts
export type ID = string;
export type ISODateString = string;

export type AssetKind = 'image' | 'video' | 'audio' | 'file' | 'text';
export type CanvasNodeKind = 'image' | 'video' | 'chat' | 'asset';
export type GenerationStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type AssetReference =
  | {
      mode: 'relative';
      path: string;
    }
  | {
      mode: 'absolute';
      path: string;
    }
  | {
      mode: 'url';
      url: string;
    };

export type CanvasAsset = {
  id: ID;
  kind: AssetKind;
  name: string;
  reference: AssetReference;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  sourceGenerationId?: ID;
  missing?: boolean;
  missingPath?: string;
};

export type PromptReference = {
  token: string;
  assetId: ID;
  nodeId?: ID;
  path?: string;
  url?: string;
  kind: AssetKind;
};

export type CanvasNodeBase = {
  id: ID;
  kind: CanvasNodeKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  outputAssetIds: ID[];
};

export type ModelNodeConfig = {
  canonicalModelId: string;
  providerId?: ID;
  prompt: string;
  promptReferences: PromptReference[];
  retry: {
    enabled: boolean;
    maxAttempts: number;
  };
};

export type CanvasNode = CanvasNodeBase & {
  model?: ModelNodeConfig;
};

export type CanvasEdge = {
  id: ID;
  fromNodeId: ID;
  toNodeId: ID;
};

export type CanvasWorkflow = {
  id: ID;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  currentGenerationIds: ID[];
};

export type CanvasProjectPaths = {
  canvas: string;
  workflow: string;
  generations: string;
  prompts: string;
  workflowSnapshots: string;
  assets: {
    images: string;
    videos: string;
    files: string;
    covers: string;
  };
  exports: string;
};

export type CanvasProject = {
  id: ID;
  name: string;
  rootDir: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  paths: CanvasProjectPaths;
};
```

- [ ] **Step 4: Add canvas project factory**

Create `src/domain/canvasProject.ts`:

```ts
import type { CanvasProject, CanvasProjectPaths } from './types';

const defaultPaths: CanvasProjectPaths = {
  canvas: 'canvas.json',
  workflow: 'workflow.json',
  generations: 'history/generations.jsonl',
  prompts: 'prompts/prompts.jsonl',
  workflowSnapshots: 'history/workflow-snapshots',
  assets: {
    images: 'assets/images',
    videos: 'assets/videos',
    files: 'assets/files',
    covers: 'assets/covers',
  },
  exports: 'exports',
};

type CreateCanvasProjectInput = {
  name: string;
  rootDir: string;
  now?: string;
  id?: string;
};

export function createCanvasProject(input: CreateCanvasProjectInput): CanvasProject {
  const now = input.now ?? new Date().toISOString();

  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    rootDir: input.rootDir,
    createdAt: now,
    updatedAt: now,
    paths: defaultPaths,
  };
}
```

- [ ] **Step 5: Add sample fixture**

Create `test/fixtures/sampleCanvas.ts`:

```ts
import type { CanvasProject, CanvasWorkflow } from '../../src/domain/types';

export const sampleCanvasProject: CanvasProject = {
  id: 'canvas_sample',
  name: '样例画布',
  rootDir: '/tmp/shot-agent-sample',
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
  paths: {
    canvas: 'canvas.json',
    workflow: 'workflow.json',
    generations: 'history/generations.jsonl',
    prompts: 'prompts/prompts.jsonl',
    workflowSnapshots: 'history/workflow-snapshots',
    assets: {
      images: 'assets/images',
      videos: 'assets/videos',
      files: 'assets/files',
      covers: 'assets/covers',
    },
    exports: 'exports',
  },
};

export const sampleWorkflow: CanvasWorkflow = {
  id: 'workflow_sample',
  nodes: [],
  edges: [],
  currentGenerationIds: [],
};
```

- [ ] **Step 6: Run test**

Run: `npm test -- test/unit/canvasProject.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/canvasProject.ts test/fixtures/sampleCanvas.ts test/unit/canvasProject.test.ts
git commit -m "feat: 定义画布项目领域模型"
```

## Task 3: Provider Config and Model Mapping

**Files:**
- Create: `src/domain/provider.ts`
- Create: `src/models/providerRegistry.ts`
- Test: `test/unit/provider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Create `test/unit/provider.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  findProvidersForCanonicalModel,
  mapCanonicalModelToProviderModel,
} from '../../src/domain/provider';

const providers = [
  {
    id: 'provider_openai',
    name: 'OpenAI',
    protocol: 'openai-compatible' as const,
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
    id: 'provider_other',
    name: '第三方',
    protocol: 'openai-compatible' as const,
    baseURL: 'https://example.test/v1',
    apiTokenRef: 'secret_other',
    enabled: true,
    models: [
      {
        providerModelId: 'image-2',
        canonicalModelId: 'gpt-image-2',
        enabled: true,
      },
    ],
  },
];

describe('provider model mapping', () => {
  it('filters providers by canonical model id', () => {
    expect(findProvidersForCanonicalModel(providers, 'gpt-image-2')).toHaveLength(2);
    expect(findProvidersForCanonicalModel(providers, 'seedance2.0')).toHaveLength(0);
  });

  it('maps canonical model id to provider model id', () => {
    expect(mapCanonicalModelToProviderModel(providers[1], 'gpt-image-2')).toBe('image-2');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/unit/provider.test.ts`

Expected: FAIL because `src/domain/provider.ts` does not exist.

- [ ] **Step 3: Implement provider domain**

Create `src/domain/provider.ts`:

```ts
import type { ID } from './types';

export type ProviderProtocol =
  | 'openai-compatible'
  | 'anthropic-compatible'
  | 'volcengine'
  | 'custom';

export type BillingConfig =
  | {
      mode: 'official-token';
      inputTokenPrice?: number;
      outputTokenPrice?: number;
      currency?: string;
    }
  | {
      mode: 'per-call';
      pricePerCall?: number;
      currency?: string;
    }
  | {
      mode: 'none';
    };

export type ProviderModelConfig = {
  providerModelId: string;
  canonicalModelId: string;
  displayName?: string;
  billing?: BillingConfig;
  enabled: boolean;
};

export type ProviderConfig = {
  id: ID;
  name: string;
  protocol: ProviderProtocol;
  baseURL: string;
  apiTokenRef: string;
  models: ProviderModelConfig[];
  enabled: boolean;
};

export function findProvidersForCanonicalModel(
  providers: ProviderConfig[],
  canonicalModelId: string,
): ProviderConfig[] {
  return providers.filter(
    (provider) =>
      provider.enabled &&
      provider.models.some(
        (model) => model.enabled && model.canonicalModelId === canonicalModelId,
      ),
  );
}

export function mapCanonicalModelToProviderModel(
  provider: ProviderConfig,
  canonicalModelId: string,
): string | undefined {
  return provider.models.find(
    (model) => model.enabled && model.canonicalModelId === canonicalModelId,
  )?.providerModelId;
}
```

- [ ] **Step 4: Add provider registry interface**

Create `src/models/providerRegistry.ts`:

```ts
import type { ProviderConfig } from '../domain/provider';

export type ProviderConnectionResult = {
  ok: boolean;
  status?: number;
  message: string;
  rawResponse?: unknown;
};

export type ProviderAdapter = {
  protocol: ProviderConfig['protocol'];
  testConnection(provider: ProviderConfig): Promise<ProviderConnectionResult>;
};

export class ProviderRegistry {
  private readonly adapters = new Map<ProviderConfig['protocol'], ProviderAdapter>();

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.protocol, adapter);
  }

  async testConnection(provider: ProviderConfig): Promise<ProviderConnectionResult> {
    const adapter = this.adapters.get(provider.protocol);

    if (!adapter) {
      return {
        ok: false,
        message: `未找到协议适配器：${provider.protocol}`,
      };
    }

    return adapter.testConnection(provider);
  }
}
```

- [ ] **Step 5: Run provider tests**

Run: `npm test -- test/unit/provider.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/provider.ts src/models/providerRegistry.ts test/unit/provider.test.ts
git commit -m "feat: 添加供应商模型映射"
```

## Task 4: Prompt Reference Parsing

**Files:**
- Create: `src/domain/promptReferences.ts`
- Test: `test/unit/promptReferences.test.ts`

- [ ] **Step 1: Write failing prompt reference tests**

Create `test/unit/promptReferences.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePromptReferences } from '../../src/domain/promptReferences';

describe('parsePromptReferences', () => {
  it('extracts @ references from prompt text', () => {
    const refs = parsePromptReferences('请参考 @image:asset_1 和 @video:asset_2 生成新视频');

    expect(refs).toEqual([
      { token: '@image:asset_1', assetId: 'asset_1', kind: 'image' },
      { token: '@video:asset_2', assetId: 'asset_2', kind: 'video' },
    ]);
  });

  it('ignores unsupported reference kinds', () => {
    const refs = parsePromptReferences('忽略 @unknown:asset_1');

    expect(refs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/unit/promptReferences.test.ts`

Expected: FAIL because `src/domain/promptReferences.ts` does not exist.

- [ ] **Step 3: Implement parser**

Create `src/domain/promptReferences.ts`:

```ts
import type { AssetKind, PromptReference } from './types';

const supportedKinds = new Set<AssetKind>(['image', 'video', 'audio', 'file', 'text']);
const referencePattern = /@(image|video|audio|file|text):([a-zA-Z0-9_-]+)/g;

export function parsePromptReferences(prompt: string): PromptReference[] {
  const references: PromptReference[] = [];

  for (const match of prompt.matchAll(referencePattern)) {
    const kind = match[1] as AssetKind;
    const assetId = match[2];

    if (!supportedKinds.has(kind)) {
      continue;
    }

    references.push({
      token: match[0],
      assetId,
      kind,
    });
  }

  return references;
}
```

- [ ] **Step 4: Run prompt tests**

Run: `npm test -- test/unit/promptReferences.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/promptReferences.ts test/unit/promptReferences.test.ts
git commit -m "feat: 添加提示词引用解析"
```

## Task 5: Generation History and Retry Defaults

**Files:**
- Create: `src/domain/generationHistory.ts`
- Test: `test/unit/generationHistory.test.ts`

- [ ] **Step 1: Write failing generation history tests**

Create `test/unit/generationHistory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createGenerationRecord, shouldRetryGeneration } from '../../src/domain/generationHistory';

describe('generation history', () => {
  it('creates a generation record with retry defaults', () => {
    const record = createGenerationRecord({
      id: 'gen_1',
      nodeId: 'node_1',
      nodeKind: 'image',
      canonicalModelId: 'gpt-image-2',
      providerId: 'provider_1',
      providerModelId: 'image-2',
      prompt: '生成一张图',
      now: '2026-05-20T00:00:00.000Z',
    });

    expect(record.retry.enabled).toBe(true);
    expect(record.retry.maxAttempts).toBe(3);
    expect(record.status).toBe('queued');
  });

  it('allows retry while attempts are below max', () => {
    const record = createGenerationRecord({
      id: 'gen_1',
      nodeId: 'node_1',
      nodeKind: 'image',
      canonicalModelId: 'gpt-image-2',
      providerId: 'provider_1',
      providerModelId: 'image-2',
      prompt: '生成一张图',
      now: '2026-05-20T00:00:00.000Z',
    });

    expect(shouldRetryGeneration({ ...record, attempts: 2, status: 'failed' })).toBe(true);
    expect(shouldRetryGeneration({ ...record, attempts: 3, status: 'failed' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/unit/generationHistory.test.ts`

Expected: FAIL because `src/domain/generationHistory.ts` does not exist.

- [ ] **Step 3: Implement generation history domain**

Create `src/domain/generationHistory.ts`:

```ts
import type { CanvasNodeKind, GenerationStatus, ID, PromptReference } from './types';

export type GenerationRecord = {
  id: ID;
  nodeId: ID;
  nodeKind: CanvasNodeKind;
  canonicalModelId: string;
  providerId: ID;
  providerModelId: string;
  prompt: string;
  promptReferences: PromptReference[];
  inputAssetIds: ID[];
  outputAssetIds: ID[];
  workflowSnapshotPath?: string;
  status: GenerationStatus;
  errorMessage?: string;
  attempts: number;
  retry: {
    enabled: boolean;
    maxAttempts: number;
  };
  usage?: unknown;
  estimatedCost?: {
    amount: number;
    currency: string;
  };
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
};

type CreateGenerationRecordInput = {
  id: ID;
  nodeId: ID;
  nodeKind: CanvasNodeKind;
  canonicalModelId: string;
  providerId: ID;
  providerModelId: string;
  prompt: string;
  promptReferences?: PromptReference[];
  inputAssetIds?: ID[];
  now?: string;
};

export function createGenerationRecord(input: CreateGenerationRecordInput): GenerationRecord {
  const now = input.now ?? new Date().toISOString();

  return {
    id: input.id,
    nodeId: input.nodeId,
    nodeKind: input.nodeKind,
    canonicalModelId: input.canonicalModelId,
    providerId: input.providerId,
    providerModelId: input.providerModelId,
    prompt: input.prompt,
    promptReferences: input.promptReferences ?? [],
    inputAssetIds: input.inputAssetIds ?? [],
    outputAssetIds: [],
    status: 'queued',
    attempts: 0,
    retry: {
      enabled: true,
      maxAttempts: 3,
    },
    createdAt: now,
  };
}

export function shouldRetryGeneration(record: GenerationRecord): boolean {
  return record.status === 'failed' && record.retry.enabled && record.attempts < record.retry.maxAttempts;
}
```

- [ ] **Step 4: Run generation history tests**

Run: `npm test -- test/unit/generationHistory.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/generationHistory.ts test/unit/generationHistory.test.ts
git commit -m "feat: 添加生成历史与重试规则"
```

## Task 6: Local Storage Path Utilities

**Files:**
- Create: `src/storage/pathUtils.ts`
- Create: `src/storage/assetStore.ts`
- Create: `src/storage/localCanvasStore.ts`
- Test: `test/unit/canvasProject.test.ts`

- [ ] **Step 1: Extend canvas project tests**

Append to `test/unit/canvasProject.test.ts`:

```ts
import { getCanvasDirectories, makeUniqueAssetName } from '../../src/storage/pathUtils';

describe('path utils', () => {
  it('returns all required canvas directories', () => {
    expect(getCanvasDirectories()).toEqual([
      'history',
      'history/workflow-snapshots',
      'prompts',
      'assets/images',
      'assets/videos',
      'assets/files',
      'assets/covers',
      'exports',
    ]);
  });

  it('creates a non-conflicting asset name', () => {
    expect(makeUniqueAssetName('image.png', new Set(['image.png']))).toBe('image-1.png');
    expect(makeUniqueAssetName('image.png', new Set(['other.png']))).toBe('image.png');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- test/unit/canvasProject.test.ts`

Expected: FAIL because `src/storage/pathUtils.ts` does not exist.

- [ ] **Step 3: Implement path utilities**

Create `src/storage/pathUtils.ts`:

```ts
export function getCanvasDirectories(): string[] {
  return [
    'history',
    'history/workflow-snapshots',
    'prompts',
    'assets/images',
    'assets/videos',
    'assets/files',
    'assets/covers',
    'exports',
  ];
}

export function makeUniqueAssetName(fileName: string, existingNames: Set<string>): string {
  if (!existingNames.has(fileName)) {
    return fileName;
  }

  const dotIndex = fileName.lastIndexOf('.');
  const baseName = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : fileName.slice(dotIndex);

  let index = 1;
  let candidate = `${baseName}-${index}${extension}`;

  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `${baseName}-${index}${extension}`;
  }

  return candidate;
}
```

- [ ] **Step 4: Add storage interfaces**

Create `src/storage/assetStore.ts`:

```ts
import type { AssetReference, CanvasAsset } from '../domain/types';

export type SaveAssetInput = {
  name: string;
  kind: CanvasAsset['kind'];
  source: AssetReference;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
};

export type AssetStore = {
  saveAsset(input: SaveAssetInput): Promise<CanvasAsset>;
  markMissing(asset: CanvasAsset, missingPath: string): CanvasAsset;
};
```

Create `src/storage/localCanvasStore.ts`:

```ts
import type { CanvasProject, CanvasWorkflow } from '../domain/types';

export type LocalCanvasStore = {
  createProject(project: CanvasProject, workflow: CanvasWorkflow): Promise<void>;
  readProject(rootDir: string): Promise<CanvasProject>;
  writeWorkflow(project: CanvasProject, workflow: CanvasWorkflow): Promise<void>;
};
```

- [ ] **Step 5: Run tests**

Run: `npm test -- test/unit/canvasProject.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/pathUtils.ts src/storage/assetStore.ts src/storage/localCanvasStore.ts test/unit/canvasProject.test.ts
git commit -m "feat: 添加本地画布存储接口"
```

## Task 7: MVP App State and Provider Filtering UI

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.css`

- [ ] **Step 1: Replace placeholder app with static MVP shell**

Modify `src/app/App.tsx`:

```tsx
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
```

- [ ] **Step 2: Update CSS for MVP shell**

Append to `src/app/App.css`:

```css
.panel h2 {
  font-size: 14px;
  margin: 0 0 10px;
}

.node-list {
  display: grid;
  gap: 8px;
}

.canvas-preview {
  align-content: start;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 360px));
  padding: 24px;
}

.node-card {
  background: #ffffff;
  border: 1px solid #d9e1e5;
  border-radius: 8px;
  display: grid;
  gap: 12px;
  padding: 16px;
}

.node-card h2 {
  font-size: 18px;
  margin: 0;
}

.node-card p {
  color: #65747d;
  margin: 0;
}

.node-card textarea {
  border: 1px solid #d9e1e5;
  border-radius: 6px;
  font: inherit;
  min-height: 96px;
  padding: 10px;
  resize: vertical;
}
```

- [ ] **Step 3: Run verification**

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx src/app/App.css
git commit -m "feat: 添加工作台基础界面"
```

## Task 8: Documentation Sync

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`

- [ ] **Step 1: Update Chinese README**

Add a “当前能力” section to `README.md`:

```markdown
## 当前能力

- React + TypeScript + Vite 应用骨架
- 画布项目领域模型
- 供应商配置与模型映射
- 提示词 `@` 引用解析
- 生成历史与重试规则
- 本地画布存储接口
```

- [ ] **Step 2: Update English README**

Add matching “Current Capabilities” section to `README.en.md`:

```markdown
## Current Capabilities

- React + TypeScript + Vite application scaffold
- Canvas project domain model
- Provider configuration and model mapping
- Prompt `@` reference parsing
- Generation history and retry rules
- Local canvas storage interfaces
```

- [ ] **Step 3: Run docs check**

Run: `git diff -- README.md README.en.md`

Expected: both README files contain matching capability sections.

- [ ] **Step 4: Commit**

```bash
git add README.md README.en.md
git commit -m "doc: 更新当前能力说明"
```

## Final Verification

- [ ] Run `npm test`

Expected: all unit tests pass.

- [ ] Run `npm run lint`

Expected: TypeScript exits 0.

- [ ] Run `npm run build`

Expected: production build exits 0.

- [ ] Run `git status --short --branch`

Expected: clean working tree on `main`.

## Gaps After This Plan

This plan intentionally stops before real filesystem writes from the browser, real model calls, tldraw integration, Cloudflare R2 uploads, import/export archives, and callback server support. Those should be implemented as follow-up plans once this MVP foundation is in place.
