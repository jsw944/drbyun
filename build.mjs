// 사용법: node build.mjs  → dist/ 에 정적 사이트 생성
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { hoursText, site, doctor, features, programs, faqs, fees, metaDefaults } from "./content.mjs";
import { loadColumns } from "./columns.mjs";

const columns = loadColumns();

// Public deployment URL, including the GitHub Pages project subdirectory.
if (process.env.SITE_URL) site.url = process.env.SITE_URL.replace(/\/+$/, "");
const basePath = new URL(site.url).pathname.replace(/\/+$/, "");

const OUT = "dist";
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (p) => site.url + p;
const addr = site.address;
const fullAddr = `${addr.region} ${addr.locality} ${addr.street}`;
rmSync(OUT, { recursive: true, force: true });
const pages = []; // sitemap 용 {path, lastmod}
const today = new Date().toISOString().slice(0, 10);

function write(path, content) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  if (path.endsWith(".html") && basePath) {
    content = content.replace(/\b(href|src|action)="\/(?!\/)/g, `$1="${basePath}/`);
  }
  writeFileSync(file, content);
}

// ───────── JSON-LD ─────────
const clinicLD = () => ({
  "@context": "https://schema.org",
  "@type": ["MedicalClinic", "LocalBusiness"],
  "@id": abs("/#clinic"),
  name: site.name,
  url: abs("/"),
  telephone: site.phone,
  ...(site.email && { email: site.email }),
  medicalSpecialty: "TraditionalChinese",
  description: metaDefaults.descHome,
  address: { "@type": "PostalAddress", addressCountry: "KR", addressRegion: addr.region, addressLocality: addr.locality, streetAddress: addr.street, postalCode: addr.postalCode },
  geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
  areaServed: site.area,
  openingHoursSpecification: site.hours.flatMap((h) =>
    (h.breakStart ? [[h.open, h.breakStart], [h.breakEnd, h.close]] : [[h.open, h.close]]).map(([o, c]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days, opens: o, closes: c }))
  ),
  founder: { "@id": abs("/about/#doctor") },
  employee: { "@id": abs("/about/#doctor") },
  ...(site.sameAs.length && { sameAs: site.sameAs }),
  ...(site.photo && { image: abs(site.photo) }),
});
const doctorLD = () => ({
  "@context": "https://schema.org",
  "@type": ["Physician", "Person"],
  "@id": abs("/about/#doctor"),
  name: doctor.name,
  jobTitle: `${doctor.title} (${doctor.license})`,
  worksFor: { "@id": abs("/#clinic") },
  medicalSpecialty: "TraditionalChinese",
  knowsAbout: doctor.specialties,
  alumniOf: { "@type": "CollegeOrUniversity", name: doctor.alumniOf },
  memberOf: doctor.memberOf.map((n) => ({ "@type": "Organization", name: n })),
  sameAs: site.sameAs,
  description: doctor.intro,
  ...(doctor.photo && { image: abs(doctor.photo) }),
});
const faqLD = (list) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: list.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});
const crumbLD = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
});
const articleLD = (c) => ({
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  headline: c.title,
  description: c.summary,
  datePublished: c.date,
  dateModified: c.updated || c.date,
  mainEntityOfPage: abs(`/columns/${c.slug}/`),
  author: { "@id": abs("/about/#doctor") },
  publisher: { "@id": abs("/#clinic") },
  reviewedBy: { "@id": abs("/about/#doctor") },
});

// ───────── 공통 조각 ─────────
const tel = `tel:${site.phone.replace(/[^0-9+]/g, "")}`;
const blogUrl = (site.sameAs || []).find((u) => u.includes("blog."));
const mapBtn = (cls = "btn btn-line") =>
  site.naverMapUrl ? `<a class="${cls}" href="${esc(site.naverMapUrl)}" target="_blank" rel="noopener">네이버 지도에서 보기</a>` : "";

const nav = [
  ["/programs/", "진료 안내"],
  ["/about/", "원장 소개"],
  ["/visit/", "처음 오시는 분"],
  ["/fees/", "비급여 진료비"],
  ["/columns/", "건강 칼럼"],
  ["/faq/", "자주 묻는 질문"],
];

const hoursList = () =>
  `<ul class="hours">${site.hours
    .map((h) => `<li><b>${esc(h.label)}</b><span>${h.open}–${h.close}${h.breakStart ? `<small>휴게 ${h.breakStart}–${h.breakEnd}</small>` : ""}</span></li>`)
    .join("")}${(site.closed || []).map((c) => `<li><b>${esc(c.label)}</b><span>${esc(c.text)}</span></li>`).join("")}</ul>`;

const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;

const placeRows = () => [
  ["주소", esc(fullAddr)],
  ["교통", esc(site.directions)],
  ["진료시간", hoursList()],
  ["주차", esc(site.parking)],
  ["전화", `<a href="${tel}">${esc(site.phone)}</a>`],
];

const secHead = (kicker, title, desc = "", id = "") =>
  `<div class="sec-head"><p class="kicker">${kicker}</p><h2${id ? ` id="${id}"` : ""}>${title}</h2>${desc ? `<p class="sec-desc">${desc}</p>` : ""}</div>`;

const pageHead = (kicker, title, lead = "") =>
  `<section class="page-head"><div class="wrap"><p class="kicker">${kicker}</p><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ""}</div></section>`;

const faqHtml = (list, open = false) =>
  `<div class="acc">${list.map((f) => `<details${open ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n")}</div>`;

const programCards = (withAll = false) =>
  `<ul class="plist">${programs
    .map((p, i) => `<li><a href="/programs/${p.slug}/"><span class="no">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p></div><span class="arr" aria-hidden="true">→</span></a></li>`)
    .join("")}${withAll ? `<li class="all"><a href="/programs/"><span class="no" aria-hidden="true">＋</span><div><h3>진료 안내 전체 보기</h3></div><span class="arr" aria-hidden="true">→</span></a></li>` : ""}</ul>`;

const columnCards = (list) =>
  `<ul class="ccards">${list
    .map((c) => {
      const pr = programs.find((p) => p.slug === c.program);
      return `<li><a href="/columns/${c.slug}/"><span class="tag">${esc(pr ? pr.name : "건강 칼럼")}</span><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><time datetime="${c.date}">${c.date}</time></a></li>`;
    })
    .join("")}</ul>`;

const arch = (lazy = true) =>
  doctor.photo
    ? `<div class="arch"><img src="${esc(doctor.photo)}" alt="${esc(site.name)} ${esc(doctor.title)} ${esc(doctor.name)}" width="158" height="234"${lazy ? ' loading="lazy"' : ""}></div>`
    : "";

const storefront = (caption = site.directions) =>
  site.photo
    ? `<figure class="photo"><img src="${esc(site.photo)}" alt="${esc(site.photoAlt)}" width="721" height="1280" loading="lazy"><figcaption>${esc(caption)}</figcaption></figure>`
    : "";

// 진료 중/휴게/종료 표시 (방문자 시간 기준이 아니라 한국 시간 기준)
const statusScript = `<script>
(function(){var el=document.querySelector("[data-hours]");if(!el)return;
var H=JSON.parse(el.getAttribute("data-hours"));
var P=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",weekday:"long",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
function g(t){for(var i=0;i<P.length;i++)if(P[i].type===t)return P[i].value}
var day=g("weekday"),min=(+g("hour")%24)*60+ +g("minute");
function m(s){var a=s.split(":");return +a[0]*60+ +a[1]}
var row=null;for(var i=0;i<H.length;i++)if(H[i].days.indexOf(day)>-1)row=H[i];
var s,c;
if(!row){s="오늘 휴진";c="off"}
else if(min<m(row.open)){s="진료 전 · "+row.open+" 시작";c="soon"}
else if(min>=m(row.close)){s="오늘 진료 종료";c="off"}
else if(row.breakStart&&min>=m(row.breakStart)&&min<m(row.breakEnd)){s="휴게시간 · "+row.breakEnd+" 재개";c="soon"}
else{s="진료 중 · "+row.close+"까지";c="on"}
el.textContent=s;el.className="status "+c})();
</script>`;

// ───────── 레이아웃 ─────────
function layout({ path, title, desc, body, ld = [], type = "website", crumbs, noindex = false }) {
  const url = abs(path);
  const all = [...ld, ...(crumbs ? [crumbLD(crumbs)] : [])];
  pages.push({ path, lastmod: today });
  const crumbBar =
    crumbs && crumbs.length > 1
      ? `<div class="crumbs-bar"><nav class="wrap crumbs" aria-label="경로">${crumbs
          .map(([n, p], i) => (i < crumbs.length - 1 ? `<a href="${p}">${esc(n)}</a><i>/</i>` : `<span aria-current="page">${esc(n)}</span>`))
          .join("")}</nav></div>`
      : "";
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="${esc(doctor.name)}">
<meta name="theme-color" content="#faf7f0">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">'}
${site.verification.google ? `<meta name="google-site-verification" content="${esc(site.verification.google)}">` : ""}
${site.verification.naver ? `<meta name="naver-site-verification" content="${esc(site.verification.naver)}">` : ""}
<meta property="og:type" content="${type}">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
${site.photo || doctor.photo ? `<meta property="og:image" content="${abs(doctor.photo || site.photo)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="alternate" type="text/plain" href="${abs("/llms.txt")}" title="LLMs">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600;700&display=swap">
<link rel="stylesheet" href="/assets/style.css">
${all.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
<a class="skip" href="#main">본문 바로가기</a>
<header class="hd"><div class="wrap">
  <a class="logo" href="/" aria-label="${esc(site.name)} 홈"><span class="logo-mark" aria-hidden="true"></span><span class="logo-text"><b>${esc(site.name)}</b><small>${esc(doctor.license)}</small></span></a>
  <nav aria-label="주 메뉴"><ul>${nav.map(([h, t]) => `<li><a href="${h}"${path.startsWith(h) ? ' aria-current="page"' : ""}>${t}</a></li>`).join("")}</ul></nav>
  <a class="call" href="${tel}">${esc(site.phone)}</a>
</div></header>
${crumbBar}
<main id="main">
${body}
</main>
<section class="cta-band" aria-label="진료 예약"><div class="wrap"><div class="cta-card">
  <div><h2>진료 예약 · 문의</h2><p>${esc(site.reservation)}</p></div>
  <a class="cta-tel" href="${tel}">${esc(site.phone)}</a>
</div></div></section>
<footer class="ft"><div class="wrap">
  <div class="ft-grid">
    <div>
      <p class="brand">${esc(site.name)}</p>
      <p>${esc(doctor.title)} ${esc(doctor.name)} · ${esc(doctor.license)}</p>
      <address>${esc(fullAddr)}<br>${esc(site.directions)}</address>
    </div>
    <div><h2>진료시간</h2>${hoursList()}</div>
    <div>
      <h2>문의</h2>
      <p><a class="ft-tel" href="${tel}">${esc(site.phone)}</a></p>
      <p>${site.naverMapUrl ? `<a href="${esc(site.naverMapUrl)}" target="_blank" rel="noopener">네이버 지도</a>` : ""}${blogUrl ? ` · <a href="${esc(blogUrl)}" target="_blank" rel="noopener">블로그</a>` : ""}</p>
    </div>
  </div>
  <div class="ft-bottom">
    <p>본 사이트의 건강 정보는 일반적인 참고 자료이며 개인별 진단·치료를 대체하지 않습니다. 정확한 판단은 진료를 통해 확인하세요.</p>
    <p>© ${new Date().getFullYear()} ${esc(site.name)} · <a href="/for-ai-agents/">For AI Agents</a> · <a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">사이트맵</a></p>
  </div>
</div></footer>
<a class="fab" href="${tel}">전화 예약 ${esc(site.phone)}</a>
</body>
</html>`;
}

// ───────── 페이지 ─────────
// 홈
const careerTop = (doctor.sections.find((s) => s.h === "주요 경력") || { items: [] }).items.slice(0, 6);
write(
  "index.html",
  layout({
    path: "/",
    title: metaDefaults.titleHome,
    desc: metaDefaults.descHome,
    ld: [clinicLD(), doctorLD(), faqLD(faqs.slice(0, 8))],
    body: `
<section class="hero">
  <div class="moon" aria-hidden="true"></div>
  <div class="wrap hero-grid">
    <div class="hero-text">
      <p class="eyebrow">${esc(site.area[0])} ${esc(site.area[1])} · ${esc(site.directions)}</p>
      <h1><span class="h1-brand">${esc(site.name)}</span> ${esc(site.tagline)}</h1>
      <p class="lead">${esc(doctor.intro)}</p>
      <div class="hero-cta">
        <a class="btn" href="${tel}">전화 예약 ${esc(site.phone)}</a>
        <a class="btn btn-line" href="/visit/">처음 오시는 분</a>
      </div>
      <ul class="chips">${doctor.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
    </div>
    <aside class="hero-card" aria-label="진료 정보">
      <div class="hc-head"><h2>진료 정보</h2><span class="status" data-hours="${esc(JSON.stringify(site.hours))}"></span></div>
      ${kv([
        ["진료시간", hoursList()],
        ["위치", `${esc(addr.locality)} ${esc(addr.street)}<small>${esc(site.directions)}</small>`],
        ["전화", `<a href="${tel}">${esc(site.phone)}</a>`],
        ["주차", esc(site.parkingShort || site.parking)],
      ])}
      ${site.naverMapUrl ? `<a class="more" href="${esc(site.naverMapUrl)}" target="_blank" rel="noopener">네이버 지도에서 길 찾기</a>` : ""}
    </aside>
  </div>
</section>

<section class="sec" aria-labelledby="tx-h"><div class="wrap">
  ${secHead("TREATMENT", "진료 안내", `${esc(site.name)}에서 진료하는 분야입니다.`, "tx-h")}
  ${programCards(true)}
</div></section>

${features.length ? `<section class="sec dark" aria-labelledby="sp-h"><div class="wrap">
  ${secHead("SPECIALTY", "변혁 한의원의 특화 치료법", "", "sp-h")}
  <ul class="feat">${features.map((f, i) => `<li><span class="no">0${i + 1}</span><h3>${esc(f.title)}</h3><p>${esc(f.desc)}</p></li>`).join("")}</ul>
</div></section>` : ""}

<section class="sec alt" aria-labelledby="doc-h"><div class="wrap doctor-grid">
  ${arch() || "<div></div>"}
  <div>
    <p class="kicker">DOCTOR</p>
    <h2 id="doc-h">${esc(doctor.title)} ${esc(doctor.name)}</h2>
    <p class="doc-lic">${esc(doctor.license)}</p>
    <p class="lede">${esc(doctor.intro)}</p>
    <ul class="check cols">${careerTop.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
    <a class="more" href="/about/">약력 전체 보기</a>
  </div>
</div></section>

<section class="sec" aria-labelledby="faq-h"><div class="wrap faq-grid">
  <div class="sec-head">
    <p class="kicker">FAQ</p><h2 id="faq-h">자주 묻는 질문</h2>
    <p class="sec-desc">진료, 예약, 주차 등 자주 문의하시는 내용입니다.</p>
    <a class="more" href="/faq/">질문 전체 보기</a>
  </div>
  ${faqHtml(faqs.slice(0, 8))}
</div></section>

${columns.length ? `<section class="sec alt" aria-labelledby="col-h"><div class="wrap">
  ${secHead("HEALTH COLUMN", "건강 칼럼", `${esc(doctor.name)} ${esc(doctor.title)}이 직접 쓰는 건강 이야기입니다.`, "col-h")}
  ${columnCards(columns.slice(0, 3))}
  <p style="margin:34px 0 0"><a class="more" href="/columns/">칼럼 전체 보기</a></p>
</div></section>` : ""}

<section class="sec${columns.length ? "" : " alt"}" aria-labelledby="visit-h"><div class="wrap">
  ${secHead("VISIT", "오시는 길", "", "visit-h")}
  <div class="visit-grid">
    <div class="info">
      ${kv(placeRows())}
      <div class="info-cta"><a class="btn" href="${tel}">전화 예약</a>${mapBtn()}</div>
    </div>
    ${storefront()}
  </div>
</div></section>
${statusScript}`,
  })
);

// 원장 소개
write(
  "about/index.html",
  layout({
    path: "/about/",
    title: `${doctor.name} ${doctor.title} 소개 | ${site.name}`,
    desc: `${site.name} ${doctor.name} ${doctor.title}의 약력과 진료 철학, 전문 분야를 소개합니다.`,
    ld: [doctorLD()],
    crumbs: [["홈", "/"], ["원장 소개", "/about/"]],
    body: `${pageHead("DOCTOR", `${doctor.name} ${doctor.title}`, doctor.intro)}
<div class="wrap page-body about-grid">
  <aside class="doc-card">
    ${arch(false)}
    <p class="doc-name">${esc(doctor.name)}<small>${esc(doctor.title)}</small></p>
    <p class="doc-lic">${esc(doctor.license)}</p>
    <ul class="tags">${doctor.specialties.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <a class="btn" href="${tel}">전화 예약</a>
  </aside>
  <div class="cv">${doctor.sections
    .map((sec) => `<section class="cv-row"><h2>${esc(sec.h)}</h2><ul class="check">${sec.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>`)
    .join("")}</div>
</div>`,
  })
);

// 처음 오시는 분 / 오시는 길
write(
  "visit/index.html",
  layout({
    path: "/visit/",
    title: `처음 오시는 분 · 진료시간 · 오시는 길 | ${site.name}`,
    desc: `${site.name} 진료시간, 예약 방법, 주차, 오시는 길 안내. ${site.directions}.`,
    ld: [clinicLD(), faqLD(faqs.filter((f) => /방문|예약|주차|시간/.test(f.q)))],
    crumbs: [["홈", "/"], ["처음 오시는 분", "/visit/"]],
    body: `${pageHead("VISIT", "처음 오시는 분", site.reservation)}
<div class="wrap page-body">
  <div class="visit-grid">
    <div class="info">
      ${kv([["예약", `<a href="${tel}">${esc(site.phone)}</a><small>${esc(site.reservation)}</small>`], ...placeRows().filter(([k]) => k !== "전화")])}
      <div class="info-cta"><a class="btn" href="${tel}">전화 예약</a>${mapBtn()}</div>
    </div>
    ${storefront()}
  </div>
  <h2 class="h2-sec">첫 방문 진행 순서</h2>
  <ol class="steps"><li>접수 및 문진표 작성</li><li>원장 직접 문진·진단</li><li>치료(침·추나 등) 및 한약 상담</li><li>생활 관리 안내와 다음 진료 계획</li></ol>
</div>`,
  })
);

// 비급여
write(
  "fees/index.html",
  layout({
    path: "/fees/",
    title: `비급여 진료비 안내 | ${site.name}`,
    desc: `${site.name}의 비급여 진료 항목과 비용 안내입니다.`,
    crumbs: [["홈", "/"], ["비급여 진료비", "/fees/"]],
    body: `${pageHead("FEES", "비급여 진료비 안내", "진료 상태에 따라 달라질 수 있으며, 진료 전 충분히 안내해 드립니다.")}
<div class="wrap page-body">
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>항목</th><th>비용</th><th>비고</th></tr></thead><tbody>${fees
    .map((f) => `<tr><td>${esc(f.name)}</td><td>${esc(f.price)}</td><td>${esc(f.note)}</td></tr>`)
    .join("")}</tbody></table></div>
</div>`,
  })
);

// 진료 안내
write(
  "programs/index.html",
  layout({
    path: "/programs/",
    title: `진료 안내 | ${site.name}`,
    desc: `${site.name}에서 진료하는 ${programs.map((p) => p.name).join(", ")} 안내.`,
    crumbs: [["홈", "/"], ["진료 안내", "/programs/"]],
    body: `${pageHead("TREATMENT", "진료 안내", `${site.name}에서 진료하는 분야입니다.`)}
<div class="wrap page-body">${programCards()}</div>`,
  })
);
for (const p of programs) {
  const related = columns.filter((c) => c.program === p.slug);
  const pf = [...p.faqs];
  write(
    `programs/${p.slug}/index.html`,
    layout({
      path: `/programs/${p.slug}/`,
      title: `${p.name} 한의원 치료 | ${site.area[0]} ${site.name}`,
      desc: `${p.summary} ${site.name} ${doctor.name} ${doctor.title} 직접 진료.`,
      ld: [pf.length && faqLD(pf)].filter(Boolean),
      crumbs: [["홈", "/"], ["진료 안내", "/programs/"], [p.name, `/programs/${p.slug}/`]],
      body: `${pageHead("TREATMENT", p.name, p.summary)}
<div class="wrap page-body detail-grid">
  <div class="detail-main">
    <p class="intro">${esc(p.intro)}</p>
    <h2>이런 증상이 있다면</h2>
    <ul class="check">${p.symptoms.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    <h2>치료 방법</h2>
    <ul class="tags">${p.treatments.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    ${pf.length ? `<h2>자주 묻는 질문</h2>${faqHtml(pf, true)}` : ""}
    ${related.length ? `<h2>관련 칼럼</h2><ul class="rel">${related.map((c) => `<li><a href="/columns/${c.slug}/">${esc(c.title)}</a></li>`).join("")}</ul>` : ""}
  </div>
  <aside class="side-card">
    <h2>진료 예약</h2>
    <a class="btn" href="${tel}">${esc(site.phone)}</a>
    ${hoursList()}
    <h3>다른 진료 안내</h3>
    <ul class="side-links">${programs.filter((o) => o.slug !== p.slug).map((o) => `<li><a href="/programs/${o.slug}/">${esc(o.name)}</a></li>`).join("")}</ul>
  </aside>
</div>`,
    })
  );
}

// FAQ
write(
  "faq/index.html",
  layout({
    path: "/faq/",
    title: `자주 묻는 질문 | ${site.name}`,
    desc: `${site.name} 진료, 예약, 주차, 한약, 비용에 대한 자주 묻는 질문과 답변.`,
    ld: [faqLD(faqs)],
    crumbs: [["홈", "/"], ["자주 묻는 질문", "/faq/"]],
    body: `${pageHead("FAQ", "자주 묻는 질문", `${site.name} 진료, 예약, 주차 등 자주 문의하시는 내용입니다.`)}
<div class="wrap narrow page-body">${faqHtml(faqs, true)}</div>`,
  })
);

// 칼럼
write(
  "columns/index.html",
  layout({
    path: "/columns/",
    title: `건강 칼럼 | ${site.name} ${doctor.name} ${doctor.title}`,
    desc: `${doctor.name} ${doctor.title}이 직접 쓴 건강 칼럼 모음.`,
    crumbs: [["홈", "/"], ["건강 칼럼", "/columns/"]],
    body: `${pageHead("HEALTH COLUMN", "건강 칼럼", `${doctor.name} ${doctor.title}이 직접 쓰는 건강 이야기입니다.`)}
<div class="wrap page-body">${columns.length ? columnCards(columns) : `<p class="empty">칼럼을 준비하고 있습니다.</p>`}</div>`,
  })
);
for (const c of columns) {
  const pr = programs.find((p) => p.slug === c.program);
  write(
    `columns/${c.slug}/index.html`,
    layout({
      path: `/columns/${c.slug}/`,
      title: `${c.title} | ${site.name}`,
      desc: c.summary,
      type: "article",
      ld: [articleLD(c)],
      crumbs: [["홈", "/"], ["건강 칼럼", "/columns/"], [c.title, `/columns/${c.slug}/`]],
      body: `<article class="wrap narrow article">
  <header>
    <p class="kicker">HEALTH COLUMN</p>
    <h1>${esc(c.title)}</h1>
    <p class="meta"><span>글 <a href="/about/">${esc(doctor.name)} ${esc(doctor.title)}</a></span><time datetime="${c.date}">${c.date}</time>${pr ? `<span>관련 진료 <a href="/programs/${pr.slug}/">${esc(pr.name)}</a></span>` : ""}</p>
  </header>
  <p class="sumbox">${esc(c.summary)}</p>
  <div class="prose">${c.html}</div>
  <aside class="author">
    ${doctor.photo ? `<img src="${esc(doctor.photo)}" alt="${esc(doctor.name)} ${esc(doctor.title)}" width="68" height="68" loading="lazy">` : ""}
    <p><b>${esc(doctor.name)} ${esc(doctor.title)}</b><br>${esc(doctor.license)} · <a href="/about/">원장 소개 보기</a></p>
  </aside>
  <p class="notice">이 글은 일반적인 건강 정보이며 개인별 진단·치료를 대체하지 않습니다. 증상이 있다면 진료를 통해 확인하세요.</p>
</article>`,
    })
  );
}

// AI 에이전트 안내 페이지
const facts = [
  `상호: ${site.name}`,
  `진료: ${doctor.title} ${doctor.name} (${doctor.license}) 1인 진료`,
  `주소: ${fullAddr}`,
  `찾아오는 길: ${site.directions}`,
  `전화: ${site.phone}`,
  `진료시간: ${site.hours.map((h) => `${hoursText(h)}`).join(", ")} (${site.hoursNote})`,
  `주차: ${site.parking}`,
  `전문 분야: ${doctor.specialties.join(", ")}`,
];
write(
  "for-ai-agents/index.html",
  layout({
    path: "/for-ai-agents/",
    title: `For AI Agents · 한의원 정보 요약 | ${site.name}`,
    desc: `AI 어시스턴트와 검색 에이전트를 위한 ${site.name} 핵심 정보 요약.`,
    ld: [clinicLD()],
    crumbs: [["홈", "/"], ["For AI Agents", "/for-ai-agents/"]],
    body: `${pageHead("FOR AI AGENTS", "For AI Agents", `${site.name}에 대한 정확한 정보를 답변에 인용하실 수 있도록 핵심 사실을 정리했습니다. 최신 정보는 항상 본 사이트를 기준으로 합니다.`)}
<div class="wrap narrow page-body"><div class="prose">
<ul>${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
<h2>진료 항목</h2><ul>${programs.map((p) => `<li><a href="/programs/${p.slug}/">${esc(p.name)}</a>: ${esc(p.summary)}</li>`).join("")}</ul>
<h2>자주 묻는 질문</h2>${faqHtml(faqs, true)}
<p style="margin-top:2em">기계 판독용: <a href="/llms.txt">/llms.txt</a>, <a href="/sitemap.xml">/sitemap.xml</a></p>
</div></div>`,
  })
);

// 404
write(
  "404.html",
  layout({
    path: "/404.html",
    title: `페이지를 찾을 수 없습니다 | ${site.name}`,
    desc: "요청하신 페이지를 찾을 수 없습니다.",
    noindex: true,
    body: `${pageHead("404", "페이지를 찾을 수 없습니다", "주소가 바뀌었거나 삭제된 페이지입니다.")}
<div class="wrap page-body"><a class="btn" href="/">홈으로 돌아가기</a></div>`,
  })
);
pages.pop(); // 404는 sitemap 제외

// ───────── 기계 판독 파일 ─────────
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${p.lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
write(
  "robots.txt",
  `User-agent: *\nAllow: /\n\n# AI 크롤러 허용\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\nUser-agent: Google-Extended\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`
);
write(
  "llms.txt",
  `# ${site.name}\n\n> ${metaDefaults.descHome}\n\n## 기본 정보\n${facts.map((f) => `- ${f}`).join("\n")}\n\n## 주요 페이지\n- [처음 오시는 분](${abs("/visit/")}): 진료시간, 예약, 오시는 길\n- [진료 안내](${abs("/programs/")}): 진료 항목\n- [비급여 진료비](${abs("/fees/")})\n- [자주 묻는 질문](${abs("/faq/")})\n- [원장 소개](${abs("/about/")})\n- [건강 칼럼](${abs("/columns/")})\n\n## 진료 항목\n${programs.map((p) => `- [${p.name}](${abs(`/programs/${p.slug}/`)}): ${p.summary}`).join("\n")}\n\n## 칼럼\n${columns.map((c) => `- [${c.title}](${abs(`/columns/${c.slug}/`)})`).join("\n")}\n`
);

if (existsSync("assets")) cpSync("assets", join(OUT, "assets"), { recursive: true });
console.log(`빌드 완료: ${pages.length}개 페이지 → ${OUT}/`);
