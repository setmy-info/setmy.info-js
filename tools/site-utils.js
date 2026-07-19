import fs from "node:fs";
import path from "node:path";

export function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function renderPage(title, bodyHtml) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
      table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
      th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; font-size: 0.9rem; }
      th { background: #f0f0f0; }
      nav a { margin-right: 1rem; }
      .ok { color: #1a7a1a; }
      .warn { color: #a06a00; }
      .error { color: #b30000; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    ${bodyHtml}
  </body>
</html>
`;
}

export function writePage(filePath, title, bodyHtml) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, renderPage(title, bodyHtml));
}

export function parseLcov(lcovText) {
    const files = [];
    let current = null;

    for (const line of lcovText.split("\n")) {
        if (line.startsWith("SF:")) {
            current = {
                file: line.slice(3).trim(),
                linesFound: 0,
                linesHit: 0,
            };
            files.push(current);
        } else if (line.startsWith("LF:")) {
            current.linesFound = Number(line.slice(3));
        } else if (line.startsWith("LH:")) {
            current.linesHit = Number(line.slice(3));
        }
    }

    return files;
}
