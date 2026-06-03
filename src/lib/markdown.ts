const collapseThreshold = 720;

const allowedHtmlTags = new Set([
  'a',
  'article',
  'b',
  'blockquote',
  'br',
  'code',
  'dd',
  'del',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'kbd',
  'li',
  'main',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'section',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const blockLikeHtmlTags = new Set([
  'article',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

const paragraphContainerTags = new Set(['div', 'span']);
const blockedHtmlTags = new Set(['script', 'style', 'iframe', 'object', 'embed']);

export function shouldCollapseMarkdown(value: string): boolean {
  return value.length > collapseThreshold;
}

export function renderMarkdownToHtml(markdown: string): string {
  const value = markdown.trim();
  if (!value) {
    return '';
  }

  if (isLikelyHtmlContent(value)) {
    return sanitizeHtmlFragment(value);
  }

  const blocks = splitMarkdownBlocks(value);

  return blocks
    .map((block) => renderMarkdownBlock(block))
    .join('');
}

function isLikelyHtmlContent(value: string) {
  return /^\s*<\/?[a-z][\w-]*[\s/>]/i.test(value);
}

function sanitizeHtmlFragment(value: string): string {
  if (typeof DOMParser === 'undefined') {
    return `<p>${renderInline(escapeHtml(value)).replace(/\n/g, '<br>')}</p>`;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(value, 'text/html');

  return Array.from(document.body.childNodes)
    .map((node) => sanitizeHtmlNode(node, true))
    .join('');
}

function sanitizeHtmlNode(node: Node, atRoot = false): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text.trim()) {
      return atRoot ? '' : escapeHtml(text);
    }

    const content = renderInline(escapeHtml(text)).replace(/\n/g, '<br>');
    return atRoot ? `<p>${content}</p>` : content;
  }

  if (!(node instanceof Element)) {
    return '';
  }

  const tag = node.tagName.toLowerCase();

  if (blockedHtmlTags.has(tag)) {
    return '';
  }

  if (!allowedHtmlTags.has(tag)) {
    return Array.from(node.childNodes)
      .map((child) => sanitizeHtmlNode(child, atRoot))
      .join('');
  }

  if (tag === 'a') {
    return sanitizeAnchor(node);
  }

  if (tag === 'br' || tag === 'hr') {
    return `<${tag}>`;
  }

  const children = Array.from(node.childNodes)
    .map((child) => sanitizeHtmlNode(child))
    .join('');

  if (paragraphContainerTags.has(tag) && atRoot) {
    if (!children.trim()) {
      return '';
    }

    const containsBlockChild = Array.from(node.children).some((child) =>
      blockLikeHtmlTags.has(child.tagName.toLowerCase()),
    );

    return containsBlockChild ? children : `<p>${children}</p>`;
  }

  if (tag === 'pre') {
    const code = node.querySelector('code');
    if (code) {
      const className = sanitizeCodeClass(code.getAttribute('class'));
      const language = className ? ` class="${className}"` : '';
      return `<pre><code${language}>${escapeHtml(code.textContent ?? '')}</code></pre>`;
    }

    return `<pre>${escapeHtml(node.textContent ?? '')}</pre>`;
  }

  if (tag === 'code') {
    const className = sanitizeCodeClass(node.getAttribute('class'));
    const language = className ? ` class="${className}"` : '';
    return `<code${language}>${escapeHtml(node.textContent ?? '')}</code>`;
  }

  return `<${tag}>${children}</${tag}>`;
}

function sanitizeAnchor(node: Element) {
  const href = node.getAttribute('href') ?? '';
  const safeHref = /^(https?:)?\/\//i.test(href) ? href : '';
  const content = Array.from(node.childNodes)
    .map((child) => sanitizeHtmlNode(child))
    .join('');

  if (!safeHref) {
    return content;
  }

  return `<a href="${escapeAttributeValue(safeHref)}" target="_blank" rel="noreferrer">${content}</a>`;
}

function sanitizeCodeClass(value: string | null) {
  if (!value) {
    return '';
  }

  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .find((item) => /^language-[a-z0-9_-]+$/i.test(item)) ?? '';
}

function renderMarkdownBlock(block: string): string {
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

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
