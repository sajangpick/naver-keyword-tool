const fs = require("fs");
const path = require("path");

const LOG_PATH = path.join(process.cwd(), "docs", "AI_LOG.md");

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return null;
  }
}

function writeFileSafe(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

function splitSections(md) {
  const lines = md.split("\n");
  const head = [];
  const sections = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { title: line.substring(3).trim(), lines: [line] };
    } else {
      if (current) current.lines.push(line);
      else head.push(line);
    }
  }
  if (current) sections.push(current);
  return { head: head.join("\n"), sections };
}

function mergeDuplicateSections(sections) {
  const map = new Map();
  const order = [];
  for (const s of sections) {
    const key = s.title;
    if (!map.has(key)) {
      map.set(key, s);
      order.push(key);
    } else {
      // merge: unique union of lines (keep order), prefer first section header and separators
      const prev = map.get(key);
      const set = new Set(prev.lines.concat(s.lines));
      map.set(key, { title: key, lines: Array.from(set) });
    }
  }
  return order.map((k) => map.get(k));
}

function buildRecentSummary(sections, max = 10) {
  const items = sections.slice(0, max).map((s) => `- ${s.title}`);
  const summary = ["## 최근 요약", "", ...items, "", "---", ""].join("\n");
  return summary;
}

function injectSummaryAndEmit(head, sections, summaryBlock) {
  // Ensure summary exists just after H1 block
  const headLines = head.split("\n");
  const h1EndIndex = headLines.findIndex((l) => l.trim() === "---");
  let before = head;
  if (h1EndIndex >= 0) {
    const beforeLines = headLines.slice(0, h1EndIndex + 1);
    const afterLines = headLines.slice(h1EndIndex + 1).join("\n");
    // remove existing '## 최근 요약' block if present
    const afterClean = afterLines.replace(/## 최근 요약[\s\S]*?---\n?/m, "");
    before = beforeLines.join("\n") + "\n" + summaryBlock + afterClean;
  } else {
    // fallback: prepend
    before = head + "\n" + summaryBlock;
  }

  const body = sections.map((s) => s.lines.join("\n")).join("\n");
  return before + body;
}

function main() {
  const md = readFileSafe(LOG_PATH);
  if (!md) {
    console.error("AI_LOG.md not found");
    process.exit(0);
  }

  const { head, sections } = splitSections(md);
  if (sections.length === 0) process.exit(0);

  const merged = mergeDuplicateSections(sections);
  const summary = buildRecentSummary(merged);
  const next = injectSummaryAndEmit(head, merged, summary);

  if (next !== md) {
    writeFileSafe(LOG_PATH, next);
    console.log("AI_LOG.md summarized and de-duplicated.");
    process.exit(2); // signal change
  } else {
    console.log("AI_LOG.md already clean.");
  }
}

main();
