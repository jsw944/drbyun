// columns/*.md 를 읽어 칼럼 목록으로 변환합니다. (build.mjs 와 admin.mjs 가 함께 사용)
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const COLUMN_DIR = "columns";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

// 간단 마크다운: ## 소제목, ### 소소제목, - 목록, 1. 번호목록, **굵게**, [링크](url), 빈 줄 = 문단 구분
export function renderMarkdown(src) {
  const out = [];
  let list = null; // "ul" | "ol"
  let para = [];
  const flushPara = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`</${list}>`); list = null; };
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { flushPara(); flushList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { flushPara(); if (list !== "ul") { flushList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) { flushPara(); if (list !== "ol") { flushList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return out.join("\n");
}

export function parseColumn(slug, text) {
  const m = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = {};
  if (m) for (const l of m[1].split(/\r?\n/)) { const i = l.indexOf(":"); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  const body = m ? m[2].trim() : text.trim();
  return {
    slug,
    title: meta.title || slug,
    date: meta.date || "",
    updated: meta.updated || "",
    program: meta.program || "",
    summary: meta.summary || "",
    draft: meta.draft === "true",
    body,
    html: renderMarkdown(body),
  };
}

export function serializeColumn(c) {
  const lines = ["---", `title: ${c.title}`, `date: ${c.date}`];
  if (c.updated) lines.push(`updated: ${c.updated}`);
  lines.push(`program: ${c.program}`, `summary: ${c.summary}`);
  if (c.draft) lines.push("draft: true");
  lines.push("---", "", c.body.trim(), "");
  return lines.join("\n");
}

export function loadColumns({ includeDraft = false } = {}) {
  if (!existsSync(COLUMN_DIR)) return [];
  return readdirSync(COLUMN_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseColumn(f.slice(0, -3), readFileSync(join(COLUMN_DIR, f), "utf8")))
    .filter((c) => includeDraft || !c.draft)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
