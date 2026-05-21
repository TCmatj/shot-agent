import { describe, expect, it } from 'vitest';
import { renderMarkdownToHtml, shouldCollapseMarkdown } from '../../src/lib/markdown';

describe('markdown rendering', () => {
  it('renders basic markdown while escaping unsafe html', () => {
    expect(renderMarkdownToHtml('## 标题\n\n**重点** 和 `code`\n\n<script>x</script>')).toBe(
      '<h2>标题</h2><p><strong>重点</strong> 和 <code>code</code></p><p>&lt;script&gt;x&lt;/script&gt;</p>',
    );
  });

  it('renders common model markdown blocks', () => {
    expect(
      renderMarkdownToHtml(
        [
          '> 引用',
          '',
          '1. 第一步',
          '2. 第二步',
          '',
          '```ts',
          'const value = "<safe>";',
          '```',
          '',
          '[OpenAI](https://openai.com)',
        ].join('\n'),
      ),
    ).toBe(
      '<blockquote><p>引用</p></blockquote><ol><li>第一步</li><li>第二步</li></ol><pre><code class="language-ts">const value = &quot;&lt;safe&gt;&quot;;</code></pre><p><a href="https://openai.com" target="_blank" rel="noreferrer">OpenAI</a></p>',
    );
  });

  it('collapses long markdown outputs', () => {
    expect(shouldCollapseMarkdown('短内容')).toBe(false);
    expect(shouldCollapseMarkdown('a'.repeat(721))).toBe(true);
  });
});
