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

  it('preserves reasonable html fragments while stripping unsafe tags and attributes', () => {
    expect(
      renderMarkdownToHtml(
        [
          '<h1>主标题</h1>',
          '<p>正文 <strong>加粗</strong> <em>强调</em> <a href="https://openai.com" onclick="evil()">链接</a></p>',
          '<ul><li>项目一</li><li>项目二</li></ul>',
          '<blockquote><p>引用段落</p></blockquote>',
          '<pre><code class="language-ts extra">const x = 1;</code></pre>',
          '<table><thead><tr><th>列</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table>',
          '<script>alert(1)</script>',
        ].join(''),
      ),
    ).toBe(
      '<h1>主标题</h1><p>正文 <strong>加粗</strong> <em>强调</em> <a href="https://openai.com" target="_blank" rel="noreferrer">链接</a></p><ul><li>项目一</li><li>项目二</li></ul><blockquote><p>引用段落</p></blockquote><pre><code class="language-ts">const x = 1;</code></pre><table><thead><tr><th>列</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table>',
    );
  });

  it('supports common semantic html containers and inline rich text tags', () => {
    expect(
      renderMarkdownToHtml(
        [
          '<section><header><h2>章节标题</h2></header><p>正文 <mark>重点</mark> <kbd>Cmd</kbd>+<kbd>K</kbd></p></section>',
          '<article><dl><dt>术语</dt><dd>解释</dd></dl><p><del>旧内容</del> <u>下划线</u> H<sub>2</sub>O x<sup>2</sup></p></article>',
        ].join(''),
      ),
    ).toBe(
      '<section><header><h2>章节标题</h2></header><p>正文 <mark>重点</mark> <kbd>Cmd</kbd>+<kbd>K</kbd></p></section><article><dl><dt>术语</dt><dd>解释</dd></dl><p><del>旧内容</del> <u>下划线</u> H<sub>2</sub>O x<sup>2</sup></p></article>',
    );
  });

  it('unwraps unsupported html containers while keeping safe child content', () => {
    expect(
      renderMarkdownToHtml('<aside><div>段落一</div><div><p>段落二</p></div></aside>'),
    ).toBe('<p>段落一</p><p>段落二</p>');
  });

  it('collapses long markdown outputs', () => {
    expect(shouldCollapseMarkdown('短内容')).toBe(false);
    expect(shouldCollapseMarkdown('a'.repeat(721))).toBe(true);
  });
});
