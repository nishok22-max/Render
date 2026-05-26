/**
 * ThinkSync OS â€” Premium PDF Export Engine v2
 *
 * Renders research reports as publication-quality, editorial-grade PDFs.
 * No system metadata. No AI debug labels. Just clean, beautiful content.
 */

import type { ResearchSource } from '../services/researchService';

export interface PdfExportOptions {
  query: string;
  report: string;
  sources: ResearchSource[];
  subQueries?: string[];
  confidence?: number;
  totalSources?: number;
  durationMs?: number;
  depth?: number;
}

// â”€â”€ Markdown â†’ HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function markdownToHtml(md: string, sources: ResearchSource[]): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] | null = null;
  let i = 0;

  const flushTable = () => {
    if (!tableRows.length) return;
    const head = tableHeader
      ? `<thead><tr>${tableHeader.map(h => `<th>${h.trim()}</th>`).join('')}</tr></thead>`
      : '';
    const body = `<tbody>${tableRows.map(row =>
      `<tr>${row.map(cell => `<td>${inlineMarkdown(cell.trim(), sources)}</td>`).join('')}</tr>`
    ).join('')}</tbody>`;
    out.push(`<table>${head}${body}</table>`);
    tableRows = [];
    tableHeader = null;
    inTable = false;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks
    if (/^```/.test(line)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeBuffer = [];
      } else {
        const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
        out.push(`<pre><code${langClass}>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeLang = '';
        codeBuffer = [];
      }
      i++; continue;
    }

    if (inCodeBlock) { codeBuffer.push(line); i++; continue; }

    // Tables
    if (/^\|.+\|/.test(line)) {
      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (/^[\|\s\-:]+$/.test(line)) { i++; continue; } // separator row
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      i++; continue;
    } else if (inTable) {
      flushTable();
    }

    // Headings
    if (/^#{1,6}\s/.test(line)) {
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (m) {
        const level = m[1].length;
        const text = inlineMarkdown(m[2], sources);
        out.push(`<h${level}>${text}</h${level}>`);
      }
      i++; continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push('<hr>');
      i++; continue;
    }

    // Blockquote
    if (/^>\s/.test(line)) {
      const content = line.replace(/^>\s/, '');
      out.push(`<blockquote>${inlineMarkdown(content, sources)}</blockquote>`);
      i++; continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*]\s/, ''), sources)}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s/, ''), sources)}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      out.push('');
      i++; continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^[#>|`\-*\d]/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${inlineMarkdown(paraLines.join(' '), sources)}</p>`);
    }
  }

  if (inTable) flushTable();
  return out.join('\n');
}

function inlineMarkdown(text: string, sources: ResearchSource[]): string {
  return text
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Citation refs [1], [2], etc. â†’ link to source
    .replace(/\[(\d+)\]/g, (_, num) => {
      const idx = parseInt(num, 10) - 1;
      const src = sources[idx];
      const href = src?.url ?? '#';
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="citation">[${num}]</a>`;
    })
    // Markdown links [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    );
}

// â”€â”€ HTML template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildHtml(opts: PdfExportOptions): string {
  const { query, report, sources } = opts;

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const reportHtml = markdownToHtml(report, sources);

  const refsHtml = sources.length
    ? sources.map((src, i) => {
        const domain = getDomain(src.url);
        const title = escapeHtml(src.title || 'Untitled');
        const url = escapeHtml(src.url);
        return `
        <div class="ref-item">
          <span class="ref-num">${i + 1}.</span>
          <div class="ref-body">
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="ref-title">${title}</a>
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="ref-url">${domain}</a>
          </div>
        </div>`;
      }).join('')
    : '<p class="ref-empty">No sources recorded.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(query)}</title>
  <style>
    /* â”€â”€ Fonts â”€â”€ */
    @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    /* â”€â”€ Reset â”€â”€ */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* â”€â”€ Page â”€â”€ */
    @page {
      size: A4;
      margin: 25mm 22mm 28mm 22mm;
    }

    @page :first {
      margin-top: 32mm;
    }

    /* â”€â”€ Root â”€â”€ */
    :root {
      --serif: 'EB Garamond', Georgia, 'Times New Roman', serif;
      --sans:  'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --mono:  'JetBrains Mono', 'Fira Code', monospace;
      --ink:         #1c1c1e;
      --ink-soft:    #3a3a3c;
      --ink-muted:   #636366;
      --ink-faint:   #aeaeb2;
      --rule:        #d1d1d6;
      --rule-light:  #e5e5ea;
      --highlight:   #8b6914;
      --bg-code:     #f5f5f0;
      --bg-quote:    #fafaf8;
    }

    html, body {
      font-family: var(--serif);
      font-size: 11.5pt;
      line-height: 1.78;
      color: var(--ink);
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* â”€â”€ Running header / footer via CSS counters â”€â”€ */
    body { counter-reset: page-num; }

    /* â”€â”€ Title block â”€â”€ */
    .title-block {
      border-bottom: 2px solid var(--ink);
      padding-bottom: 18pt;
      margin-bottom: 30pt;
    }

    .pub-label {
      font-family: var(--sans);
      font-size: 7pt;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--ink-faint);
      margin-bottom: 14pt;
    }

    h1.report-title {
      font-family: var(--serif);
      font-size: 28pt;
      font-weight: 600;
      font-style: italic;
      line-height: 1.18;
      color: var(--ink);
      margin-bottom: 14pt;
      letter-spacing: -0.01em;
      hyphens: auto;
    }

    .title-meta {
      font-family: var(--sans);
      font-size: 8.5pt;
      color: var(--ink-muted);
      display: flex;
      align-items: center;
      gap: 12pt;
      flex-wrap: wrap;
    }

    .title-meta time { font-weight: 500; }
    .title-meta .dot { color: var(--rule); }

    /* â”€â”€ Body text â”€â”€ */
    .report-body {
      column-count: 1;
    }

    .report-body p {
      margin-bottom: 10pt;
      text-align: justify;
      hyphens: auto;
      orphans: 3;
      widows: 3;
    }

    /* â”€â”€ Headings â”€â”€ */
    .report-body h1 {
      font-family: var(--serif);
      font-size: 20pt;
      font-weight: 600;
      font-style: italic;
      line-height: 1.25;
      color: var(--ink);
      margin: 28pt 0 10pt;
      page-break-after: avoid;
      orphans: 4;
      widows: 4;
    }

    .report-body h2 {
      font-family: var(--serif);
      font-size: 15pt;
      font-weight: 600;
      font-style: italic;
      line-height: 1.3;
      color: var(--ink);
      margin: 22pt 0 8pt;
      page-break-after: avoid;
      orphans: 3;
      widows: 3;
    }

    .report-body h3 {
      font-family: var(--sans);
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ink-soft);
      margin: 18pt 0 6pt;
      page-break-after: avoid;
    }

    .report-body h4,
    .report-body h5,
    .report-body h6 {
      font-family: var(--sans);
      font-size: 9.5pt;
      font-weight: 500;
      color: var(--ink-soft);
      margin: 14pt 0 5pt;
      page-break-after: avoid;
    }

    /* â”€â”€ Lists â”€â”€ */
    .report-body ul,
    .report-body ol {
      margin: 8pt 0 10pt 18pt;
      padding: 0;
    }

    .report-body li {
      margin-bottom: 4pt;
      text-align: left;
      orphans: 2;
      widows: 2;
    }

    .report-body ul li { list-style-type: disc; }
    .report-body ul li li { list-style-type: circle; }
    .report-body ol li { list-style-type: decimal; }

    /* â”€â”€ Blockquote â”€â”€ */
    .report-body blockquote {
      border-left: 2.5pt solid var(--highlight);
      margin: 14pt 0;
      padding: 8pt 0 8pt 16pt;
      background: var(--bg-quote);
      font-style: italic;
      color: var(--ink-soft);
      page-break-inside: avoid;
    }

    .report-body blockquote p { margin: 0; text-align: left; }

    /* â”€â”€ Code â”€â”€ */
    .report-body code {
      font-family: var(--mono);
      font-size: 8.5pt;
      background: var(--bg-code);
      padding: 1pt 4pt;
      border-radius: 2pt;
      color: var(--ink-soft);
    }

    .report-body pre {
      background: var(--bg-code);
      border: 1pt solid var(--rule-light);
      border-left: 3pt solid var(--ink-faint);
      padding: 10pt 14pt;
      margin: 12pt 0;
      overflow-x: auto;
      page-break-inside: avoid;
      border-radius: 3pt;
    }

    .report-body pre code {
      background: none;
      padding: 0;
      font-size: 8pt;
      line-height: 1.6;
    }

    /* â”€â”€ Tables â”€â”€ */
    .report-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 14pt 0;
      font-family: var(--sans);
      font-size: 9pt;
      page-break-inside: avoid;
    }

    .report-body th {
      background: var(--ink);
      color: #fff;
      font-weight: 600;
      padding: 6pt 10pt;
      text-align: left;
      font-size: 8pt;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .report-body td {
      padding: 5pt 10pt;
      border-bottom: 1pt solid var(--rule-light);
      vertical-align: top;
      color: var(--ink-soft);
    }

    .report-body tr:nth-child(even) td { background: #fafaf9; }

    /* â”€â”€ Horizontal rule â”€â”€ */
    .report-body hr {
      border: none;
      border-top: 1pt solid var(--rule);
      margin: 22pt 0;
    }

    /* â”€â”€ Links â”€â”€ */
    .report-body a {
      color: var(--highlight);
      text-decoration: underline;
      text-underline-offset: 2pt;
      text-decoration-color: rgba(139,105,20,0.35);
    }

    a.citation {
      color: var(--highlight);
      text-decoration: none;
      font-family: var(--sans);
      font-size: 7.5pt;
      font-weight: 500;
      vertical-align: super;
      line-height: 0;
      margin: 0 1pt;
    }

    /* â”€â”€ Section divider â”€â”€ */
    .section-rule {
      border: none;
      border-top: 1pt solid var(--rule);
      margin: 32pt 0 28pt;
    }

    /* â”€â”€ References section â”€â”€ */
    .references-section {
      page-break-before: always;
    }

    .ref-heading {
      font-family: var(--sans);
      font-size: 7.5pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--ink-muted);
      margin-bottom: 18pt;
      padding-bottom: 8pt;
      border-bottom: 1pt solid var(--rule);
    }

    .ref-item {
      display: flex;
      gap: 12pt;
      padding: 10pt 0;
      border-bottom: 1pt solid var(--rule-light);
      page-break-inside: avoid;
    }

    .ref-item:first-of-type { border-top: none; }

    .ref-num {
      font-family: var(--sans);
      font-size: 8pt;
      font-weight: 600;
      color: var(--ink-muted);
      min-width: 18pt;
      flex-shrink: 0;
      padding-top: 1.5pt;
    }

    .ref-body {
      display: flex;
      flex-direction: column;
      gap: 3pt;
      min-width: 0;
    }

    .ref-title {
      font-family: var(--sans);
      font-size: 9.5pt;
      font-weight: 500;
      color: var(--ink);
      text-decoration: none;
      line-height: 1.4;
      word-break: break-word;
    }

    .ref-title:hover { text-decoration: underline; }

    .ref-url {
      font-family: var(--mono);
      font-size: 7.5pt;
      color: var(--highlight);
      text-decoration: none;
      word-break: break-all;
      opacity: 0.8;
    }

    .ref-empty {
      color: var(--ink-muted);
      font-style: italic;
      font-size: 9.5pt;
    }

    /* â”€â”€ Print-specific â”€â”€ */
    @media print {
      html, body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .report-body h1,
      .report-body h2,
      .report-body h3 {
        page-break-after: avoid;
      }

      .report-body p,
      .report-body li {
        orphans: 3;
        widows: 3;
      }

      .report-body pre,
      .report-body blockquote,
      .report-body table,
      .ref-item {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <!-- â”€â”€ Title Block â”€â”€ -->
  <div class="title-block">
    <div class="pub-label">ThinkSync OS &nbsp;Â·&nbsp; Research Report</div>
    <h1 class="report-title">${escapeHtml(query)}</h1>
    <div class="title-meta">
      <time>${date}</time>
    </div>
  </div>

  <!-- â”€â”€ Report Body â”€â”€ -->
  <div class="report-body">
    ${reportHtml}
  </div>

  <!-- â”€â”€ References â”€â”€ -->
  ${sources.length ? `
  <div class="references-section">
    <div class="ref-heading">References</div>
    ${refsHtml}
  </div>` : ''}

  <script>
    // Open all links in new tab (print context safety)
    document.querySelectorAll('a').forEach(function(a) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  </script>
</body>
</html>`;
}

// â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function exportAsPDF(opts: PdfExportOptions): void {
  const html = buildHtml(opts);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const iframeWin = iframe.contentWindow;
  const iframeDoc = iframeWin?.document;
  
  if (!iframeWin || !iframeDoc) {
    // Fallback: download as HTML if iframe fails
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_report.html`;
    a.click();
    return;
  }

  // Synchronously write HTML to iframe
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Instantly trigger print
  iframeWin.focus();
  iframeWin.print();

  // Cleanup after a delay to ensure print spooler caught it
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 5000);
}
