# 변혁 한의원 홈페이지

서울 송파구 잠실나루역 인근 변혁 한의원의 정적(static) 홈페이지입니다.
외부 라이브러리 없이 Node.js만으로 `dist/` 폴더에 HTML을 생성합니다. SEO·AEO(구조화 데이터, FAQ, `llms.txt`)를 기본 포함합니다.

## 준비

- Node.js 18 이상 (개발은 v24). `npm install`은 필요 없습니다.
- 미리보기(`npm run serve`)는 처음 한 번 `serve` 패키지를 내려받으므로 인터넷이 필요합니다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run build` | `dist/` 에 사이트 생성 |
| `npm run serve` | 빌드 후 `http://localhost:3000` 미리보기 (포트가 사용 중이면 터미널 표시 주소 확인) |
| `npm run admin` | 칼럼 글쓰기 도구 `http://localhost:4000` (내 PC에서만 접속 가능) |

## 파일 구조

| 파일/폴더 | 역할 |
|---|---|
| `content.mjs` | 한의원 정보, 원장 이력, 진료 항목, FAQ, 비급여 — **여기만 고치면 사이트 전체와 SEO 데이터가 갱신됩니다** |
| `columns/*.md` | 건강 칼럼 (파일 1개 = 글 1개) |
| `columns.mjs` | 칼럼 파일 읽기, 마크다운 변환 |
| `build.mjs` | 페이지 템플릿, 구조화 데이터, sitemap/robots/llms.txt 생성 |
| `admin.mjs` | 칼럼 글쓰기·수정·삭제 도구 |
| `assets/` | `style.css`(반응형 포함), 한의원 입구·원장 사진 |
| `dist/` | 빌드 결과물 (직접 수정 금지, 이 폴더를 호스팅에 올립니다) |

## GitHub Pages 배포

저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
`.github/workflows/pages.yml`을 포함한 소스를 기본 브랜치에 커밋하고 푸시하면 자동으로 빌드 후 `dist/`를 배포합니다.
설정 변경 후에는 Actions의 **Deploy GitHub Pages → Run workflow**로 다시 실행할 수도 있습니다.

이 프로젝트의 시작 파일은 루트가 아닌 `dist/index.html`입니다. 저장소 루트를 그대로 게시하면 홈페이지가 404로 표시됩니다.
워크플로는 Pages의 실제 주소를 `SITE_URL`로 전달하므로 `/저장소명/` 경로의 메뉴·사진·CSS와 SEO URL도 자동 반영됩니다.
로컬 빌드는 `content.mjs`의 `site.url`을 사용합니다. `dist/`만 별도로 올리는 경우에는 해당 값을 실제 배포 주소로 설정하세요.

## 칼럼 작성

`npm run admin` 으로 작성하거나, `columns/주소.md` 를 직접 만들고 `npm run build` 를 실행합니다.

```
---
title: 질문형 제목 (환자가 검색창에 입력할 법한 문장)
date: 2026-11-03
program: spine-joint        # content.mjs 의 programs slug (선택)
summary: 검색 결과에 보일 요약 (100~150자)
draft: true                 # 넣으면 게시되지 않음 (선택)
---

## 결론부터 쓰는 첫 소제목

본문. **굵게**, [링크](https://...), - 목록, 1. 번호목록 사용 가능.
```

첫 소제목에 결론을 쓰면 AI 답변에 인용되기 좋습니다.

## 남은 작업 (공개 전)

- [ ] `content.mjs` → `site.url` 을 실제 도메인으로 교체 (지금은 `https://www.example.com`). 변경 후 `npm run build`
- [ ] 비급여 금액 입력 (`fees` 의 `[입력필요]`)
- [ ] 구글 서치콘솔·네이버 서치어드바이저 인증 코드를 `site.verification` 에 입력하고 `/sitemap.xml` 등록
- [ ] 원장 사진(`assets/doctor.png`)을 가로 800px 이상 고해상도로 교체 (현재 158×234px)
- [ ] 진료 항목·FAQ 문구를 원장님이 직접 검수
- [ ] 샘플 칼럼 3개를 원장님이 검수하고 수정 또는 삭제
- [ ] 의료광고 사전심의 확인: "수석 졸업", "최고위 과정", "두산 협력 한의원", 치료 효과 표현 등
- [ ] `dist/` 를 호스팅에 업로드

## 메모

- 소스는 Git으로 관리하고, `dist/`는 빌드로 재생성합니다.
- 코드에 절대 경로가 없어 어느 위치에서든 폴더 안에서 실행하면 동작합니다.
- 모바일 폭(640px 이하)에서는 하단에 전화 예약 버튼이 고정됩니다. PC 화면 스타일과는 `@media` 로 분리되어 있습니다.
- 디자인: 한지·먹·쪽빛 톤. 색은 `assets/style.css` 맨 위 `:root` 변수에서 바꿉니다.
- 글꼴은 외부에서 불러옵니다 (Pretendard: jsDelivr, Noto Serif KR: Google Fonts). 오프라인이면 시스템 글꼴로 보입니다.
- 메인 화면의 "진료 중/휴게시간/종료" 표시는 `site.hours` 를 읽어 한국 시간 기준으로 자동 계산됩니다.
- 메인·푸터에 쓰이는 값: `site.closed`(휴진 요일), `site.parkingShort`(주차 요약), `doctor.highlights`(배지), `features`(특화 치료법 3칸)
- `.claude/launch.json` 은 Claude Code 미리보기용 설정입니다 (포트 3100).
