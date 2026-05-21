const collapseThreshold = 720;

export function shouldCollapseMarkdown(value: string): boolean {
  return value.length > collapseThreshold;
}

export function renderMarkdownToHtml(markdown: string): string {
  const blocks = splitMarkdownBlocks(markdown.trim());

  return blocks
    .map((block) => renderBlock(block))
    .join('');
}

function renderBlock(block: string): string {
  const fence = block.match(/^```([a-zA-Z0-9_-]*)\n([\s\S]*?)\n```$/);
  if (fence) {
    const language = fence[1] ? ` class="language-${escapeAttribute(fence[1])}"` : '';
    return `<pre><code${language}>${escapeHtml(fence[2])}</code></pre>`;
  }

  if (block.startsWith('> ')) {
    const quote = block
      .split('\n')
      .map((line) => line.replace(/^>\s?/, ''))
      .join('\n');
    return `<blockquote>${renderMarkdownToHtml(quote)}</blockquote>`;
  }

  if (/^\d+\.\s/.test(block)) {
    const items = block
      .split('\n')
      .filter((line) => /^\d+\.\s/.test(line))
      .map((line) => `<li>${renderInline(escapeHtml(line.replace(/^\d+\.\s/, '')))}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  }

  const escaped = escapeHtml(block.trim());

  if (escaped.startsWith('### ')) {
    return `<h3>${renderInline(escaped.slice(4))}</h3>`;
  }

  if (escaped.startsWith('## ')) {
    return `<h2>${renderInline(escaped.slice(3))}</h2>`;
  }

  if (escaped.startsWith('# ')) {
    return `<h1>${renderInline(escaped.slice(2))}</h1>`;
  }

  if (escaped.startsWith('- ')) {
    const items = escaped
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => `<li>${renderInline(line.slice(2))}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  }

  return `<p>${renderInline(escaped).replace(/\n/g, '<br>')}</p>`;
}

function renderInline(value: string): string {
  return value
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    )
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function splitMarkdownBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const lines = markdown.split('\n');
  let current: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      current.push(line);
      inFence = !inFence;

      if (!inFence) {
        blocks.push(current.join('\n'));
        current = [];
      }
      continue;
    }

    if (!inFence && line.trim() === '') {
      if (current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks;
}

function escapeAttribute(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
