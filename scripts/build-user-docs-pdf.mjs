import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const userDocsDir = path.join(root, "docs", "user");
const outDir = path.join(userDocsDir, "pdf");

const DOCS = [
  {
    input: "rukovodstvo-polzovatelya.md",
    output: "WMS-Rukovodstvo-polzovatelya.pdf",
    coverTitle: "Руководство пользователя",
    coverSubtitle: "Работа в веб-интерфейсе и на ТСД",
    audience: "Для операторов, кладовщиков и менеджеров склада",
  },
  {
    input: "rukovodstvo-administratora.md",
    output: "WMS-Rukovodstvo-administratora.pdf",
    coverTitle: "Руководство администратора",
    coverSubtitle: "Настройка системы, пользователи и права",
    audience: "Для администраторов склада и IT",
  },
];

const generatedAt = new Date().toLocaleDateString("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function stripLeadingH1(html) {
  return html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

function buildToc(html) {
  const headings = [];
  const re = /<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]);
    const id = match[2];
    const text = match[3].replace(/<[^>]+>/g, "").trim();
    headings.push({ level, id, text });
  }
  if (headings.length === 0) return "";

  const items = headings
    .map(
      (h) =>
        `<li class="toc-level-${h.level}"><a href="#${h.id}">${h.text}</a></li>`,
    )
    .join("\n");

  return `
    <section class="toc-page">
      <h2 class="toc-title">Содержание</h2>
      <ol class="toc">${items}</ol>
    </section>
  `;
}

function buildHtml(doc, bodyHtml) {
  const content = stripLeadingH1(bodyHtml);
  const toc = buildToc(content);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${doc.coverTitle} — WMS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 22mm;
    }

    * { box-sizing: border-box; }

    body {
      font-family: "Noto Sans", "Segoe UI", sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1a1a1a;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .cover {
      page-break-after: always;
      min-height: 255mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 8mm 4mm;
      border-bottom: 4px solid #2563eb;
    }

    .cover-kicker {
      font-size: 11pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #2563eb;
      font-weight: 700;
      margin-bottom: 12mm;
    }

    .cover h1 {
      font-size: 28pt;
      line-height: 1.15;
      margin: 0 0 6mm;
      font-weight: 700;
    }

    .cover-subtitle {
      font-size: 14pt;
      color: #444;
      margin-bottom: 18mm;
    }

    .cover-meta {
      margin-top: auto;
      font-size: 10pt;
      color: #666;
      line-height: 1.7;
    }

    .cover-meta strong { color: #222; }

    .toc-page {
      page-break-after: always;
    }

    .toc-title {
      font-size: 18pt;
      margin: 0 0 8mm;
      color: #111;
    }

    .toc {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .toc li {
      margin: 0;
      padding: 2.5mm 0;
      border-bottom: 1px dotted #ccc;
      font-size: 10pt;
    }

    .toc li a {
      color: inherit;
      text-decoration: none;
    }

    .toc-level-2 { padding-left: 0; font-weight: 600; }
    .toc-level-3 { padding-left: 6mm; font-weight: 400; color: #333; }

    .content h2 {
      font-size: 15pt;
      margin: 10mm 0 4mm;
      padding-top: 2mm;
      color: #111;
      page-break-after: avoid;
    }

    .content h2:not(:first-child) {
      page-break-before: always;
    }

    .content h3 {
      font-size: 12pt;
      margin: 6mm 0 3mm;
      color: #222;
      page-break-after: avoid;
    }

    .content p { margin: 0 0 3.5mm; }

    .content ul, .content ol {
      margin: 0 0 4mm;
      padding-left: 6mm;
    }

    .content li { margin-bottom: 1.5mm; }

    .content hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 8mm 0;
    }

    .content blockquote {
      margin: 4mm 0;
      padding: 3mm 4mm;
      border-left: 3px solid #2563eb;
      background: #f8fafc;
      color: #334155;
    }

    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 4mm 0 6mm;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }

    .content th,
    .content td {
      border: 1px solid #cbd5e1;
      padding: 2.5mm 3mm;
      vertical-align: top;
      text-align: left;
    }

    .content th {
      background: #eff6ff;
      font-weight: 600;
    }

    .content tr:nth-child(even) td {
      background: #fafafa;
    }

    .content code {
      font-family: Consolas, "Courier New", monospace;
      font-size: 9pt;
      background: #f1f5f9;
      padding: 0.2mm 1mm;
      border-radius: 2px;
    }

    .content pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 3mm;
      overflow-x: auto;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    .content pre code {
      background: none;
      padding: 0;
    }

    .content a { color: #1d4ed8; text-decoration: none; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="cover-kicker">WMS — система управления складом</div>
    <h1>${doc.coverTitle}</h1>
    <p class="cover-subtitle">${doc.coverSubtitle}</p>
    <div class="cover-meta">
      <p><strong>Аудитория:</strong> ${doc.audience}</p>
      <p><strong>Дата выпуска:</strong> ${generatedAt}</p>
      <p><strong>Версия документа:</strong> 1.0</p>
    </div>
  </section>
  ${toc}
  <main class="content">${content}</main>
</body>
</html>`;
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }) {
      const text = marked.parser(tokens);
      const id = text
        .replace(/<[^>]+>/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-");
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  },
});

async function buildPdf(browser, doc) {
  const mdPath = path.join(userDocsDir, doc.input);
  const md = fs.readFileSync(mdPath, "utf8");
  const bodyHtml = marked.parse(md);
  const html = buildHtml(doc, bodyHtml);
  const outPath = path.join(outDir, doc.output);

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", right: "16mm", bottom: "22mm", left: "16mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-family: Noto Sans, Segoe UI, sans-serif; font-size: 8px; color: #888; width: 100%; padding: 0 16mm;">
      <span>${doc.coverTitle} · WMS</span>
    </div>`,
    footerTemplate: `<div style="font-family: Noto Sans, Segoe UI, sans-serif; font-size: 8px; color: #888; width: 100%; padding: 0 16mm; display: flex; justify-content: space-between;">
      <span>${generatedAt}</span>
      <span>Стр. <span class="pageNumber"></span> из <span class="totalPages"></span></span>
    </div>`,
  });
  await page.close();

  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`✓ ${doc.output} (${sizeKb} KB)`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--font-render-hinting=medium"],
  });

  try {
    for (const doc of DOCS) {
      await buildPdf(browser, doc);
    }
  } finally {
    await browser.close();
  }

  console.log(`\nPDF сохранены в: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
