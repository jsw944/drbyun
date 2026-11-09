// 건강 칼럼 글쓰기 도구 (내 컴퓨터에서만 동작)  →  npm run admin  →  http://localhost:4000
// 저장하면 columns/<주소>.md 가 만들어지고 사이트(dist/)가 자동으로 다시 빌드됩니다.
import { createServer } from "node:http";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { programs, site } from "./content.mjs";
import { COLUMN_DIR, loadColumns, serializeColumn, parseColumn } from "./columns.mjs";

const PORT = 4000;
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const today = () => new Date().toISOString().slice(0, 10);
const validSlug = (s) => /^[a-z0-9][a-z0-9-]{1,80}$/.test(s);
const fileOf = (slug) => join(COLUMN_DIR, `${slug}.md`);

function rebuild() {
  try {
    execFileSync(process.execPath, ["build.mjs"], { stdio: "pipe" });
    return "";
  } catch (e) {
    return String(e.stderr || e.message);
  }
}

const page = (body) => `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>칼럼 관리</title>
<style>body{font:16px/1.6 "Malgun Gothic",system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;color:#1d2623}
input,select,textarea{width:100%;padding:10px;border:1px solid #bbb;border-radius:8px;font:inherit;box-sizing:border-box}
textarea{min-height:420px;font-family:Consolas,monospace}label{display:block;margin:14px 0 4px;font-weight:700}
button,.b{background:#1f4eb4;color:#fff;border:0;padding:10px 18px;border-radius:8px;font:inherit;cursor:pointer;text-decoration:none;display:inline-block}
.g{background:#666}.r{background:#b3261e}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}
.ok{background:#e6f4ea;padding:10px;border-radius:8px}.err{background:#fde7e9;padding:10px;border-radius:8px;white-space:pre-wrap}small{color:#666}</style>
<body>${body}</body></html>`;

function listPage(msg = "") {
  const cols = loadColumns({ includeDraft: true });
  return page(`<h1>건강 칼럼 관리</h1>${msg}
<p><a class="b" href="/edit">+ 새 글 쓰기</a> <a class="b g" href="http://localhost:3000" target="_blank">사이트 미리보기(npm run serve)</a></p>
<table><tr><th>제목</th><th>날짜</th><th>상태</th><th></th></tr>${cols
    .map((c) => `<tr><td>${esc(c.title)}<br><small>/columns/${esc(c.slug)}/</small></td><td>${esc(c.date)}</td><td>${c.draft ? "임시저장" : "게시"}</td><td><a href="/edit?slug=${esc(c.slug)}">수정</a></td></tr>`)
    .join("")}</table>
<p><small>게시된 글은 dist/ 폴더에 반영됩니다. 실제 공개는 dist/ 를 호스팅에 올릴 때 이루어집니다.</small></p>`);
}

function formPage(c, err = "") {
  const isNew = !c.exists;
  return page(`<h1>${isNew ? "새 글 쓰기" : "글 수정"}</h1>${err ? `<p class="err">${esc(err)}</p>` : ""}
<form method="post" action="/save">
<input type="hidden" name="exists" value="${isNew ? "" : "1"}">
<label>제목 <small>환자가 검색창에 입력할 법한 질문형이 좋습니다</small></label><input name="title" required value="${esc(c.title)}">
<label>주소(영문 소문자·숫자·하이픈) <small>예: neck-pain-causes → /columns/neck-pain-causes/</small></label>
<input name="slug" required pattern="[a-z0-9][a-z0-9\\-]{1,80}" value="${esc(c.slug)}" ${isNew ? "" : "readonly"}>
<label>날짜</label><input type="date" name="date" required value="${esc(c.date || today())}">
<label>관련 진료</label><select name="program"><option value="">(없음)</option>${programs
    .map((p) => `<option value="${p.slug}"${p.slug === c.program ? " selected" : ""}>${esc(p.name)}</option>`)
    .join("")}</select>
<label>요약 <small>검색 결과 설명(메타 설명)으로 쓰입니다. 100~150자 권장</small></label><input name="summary" required value="${esc(c.summary)}">
<label>본문 <small>## 소제목 · - 목록 · 1. 번호목록 · **굵게** · [링크](주소) · 빈 줄=문단. 첫 소제목에 결론을 쓰면 AI 인용에 유리합니다.</small></label>
<textarea name="body" required>${esc(c.body)}</textarea>
<label><input type="checkbox" name="draft" value="1" style="width:auto" ${c.draft ? "checked" : ""}> 임시저장 (사이트에 게시하지 않음)</label>
<p><button>저장하고 사이트 반영</button> <a class="b g" href="/">목록</a></p></form>
${isNew ? "" : `<form method="post" action="/delete" onsubmit="return confirm('정말 삭제할까요?')"><input type="hidden" name="slug" value="${esc(c.slug)}"><button class="r">이 글 삭제</button></form>`}`);
}

const readBody = (req) =>
  new Promise((res, rej) => {
    let d = "";
    req.on("data", (x) => { d += x; if (d.length > 2e6) rej(new Error("too large")); });
    req.on("end", () => res(new URLSearchParams(d)));
  });

createServer(async (req, res) => {
  const send = (code, html, headers = {}) => { res.writeHead(code, { "content-type": "text/html; charset=utf-8", ...headers }); res.end(html); };
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // 로컬 접속만 허용 (DNS rebinding / 타 사이트 요청 차단)
  const hostOk = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || "");
  if (!hostOk) return send(403, "forbidden");
  if (req.method === "POST") {
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return send(403, "forbidden");
  }
  try {
    if (req.method === "GET" && url.pathname === "/") return send(200, listPage());
    if (req.method === "GET" && url.pathname === "/edit") {
      const slug = url.searchParams.get("slug") || "";
      if (slug) {
        if (!validSlug(slug) || !existsSync(fileOf(slug))) return send(404, page("글을 찾을 수 없습니다."));
        return send(200, formPage({ ...parseColumn(slug, readFileSync(fileOf(slug), "utf8")), exists: true }));
      }
      return send(200, formPage({ title: "", slug: "", date: today(), program: "", summary: "", body: "", draft: false }));
    }
    if (req.method === "POST" && url.pathname === "/save") {
      const f = await readBody(req);
      const c = { title: f.get("title").trim(), slug: f.get("slug").trim(), date: f.get("date"), program: f.get("program") || "", summary: f.get("summary").trim(), body: f.get("body"), draft: f.get("draft") === "1", exists: !!f.get("exists") };
      if (!validSlug(c.slug)) return send(400, formPage(c, "주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."));
      if (!c.exists && existsSync(fileOf(c.slug))) return send(400, formPage(c, "이미 같은 주소의 글이 있습니다."));
      if (/[\r\n]/.test(c.title + c.summary)) return send(400, formPage(c, "제목과 요약에는 줄바꿈을 넣을 수 없습니다."));
      if (c.exists) c.updated = today();
      writeFileSync(fileOf(c.slug), serializeColumn(c));
      const err = rebuild();
      return send(200, listPage(err ? `<p class="err">저장은 됐지만 빌드 오류:\n${esc(err)}</p>` : `<p class="ok">저장하고 사이트에 반영했습니다. (${esc(c.title)})</p>`));
    }
    if (req.method === "POST" && url.pathname === "/delete") {
      const slug = (await readBody(req)).get("slug") || "";
      if (validSlug(slug) && existsSync(fileOf(slug))) unlinkSync(fileOf(slug));
      const err = rebuild();
      return send(200, listPage(err ? `<p class="err">${esc(err)}</p>` : `<p class="ok">삭제했습니다.</p>`));
    }
    send(404, page("없는 페이지입니다."));
  } catch (e) {
    send(500, page(`<p class="err">${esc(e.message)}</p>`));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`${site.name} 칼럼 관리: http://localhost:${PORT}`));
