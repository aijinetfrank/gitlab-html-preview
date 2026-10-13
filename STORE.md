# Chrome Web Store 등록 문안

## 기본 정보

- **이름**: HTML Preview Anywhere
- **카테고리**: Developer Tools
- **언어**: English (기본), 한국어
- **공개 범위**: Unlisted 권장 (링크 있는 사람만 설치, 심사는 동일)

## 요약 (Summary, 132자 이내)

> Render HTML source found on any page — code blocks, .html links, GitLab blobs & diffs — in an isolated sandbox. Toggle per site.

## 상세 설명 (Description)

**English**

HTML Preview Anywhere renders HTML source that shows up on web pages — a code block in a chat message, pasted markup in a wiki or issue, a link to an .html file, or an .html file in a GitLab repository — right where it appears, so you can see the result instead of the markup.

How it works
- Click the toolbar icon on any site to turn the extension on for that site (origin). Click again to turn it off. Nothing runs anywhere else.
- On a GitLab instance (gitlab.com or self-hosted), .html files in blob views, commits and merge requests get a Preview toggle, with Before/After for diffs.
- On any other site, HTML source found on the page is rendered in place with Source / Fullscreen / New tab controls; .html links get a Preview button.

Security
- Everything is rendered inside the extension's own sandboxed page (null origin). Scripts in the previewed HTML cannot touch the host site's cookies, DOM or APIs, and have no extension APIs.
- The extension never contacts any server and stores no data.

**한국어**

HTML Preview Anywhere 는 웹 페이지에 올라온 HTML 소스 — 채팅 메시지의 코드 블록, 위키·이슈에 붙여넣은 마크업, .html 파일 링크, GitLab 저장소의 .html 파일 — 를 그 자리에서 렌더링해서 보여줍니다.

- 툴바 아이콘을 눌러 사이트별로 켜고 끕니다. 켜지 않은 사이트에서는 아무것도 실행되지 않습니다.
- GitLab(gitlab.com, self-hosted)에서는 blob·commit·MR 의 .html 파일에 미리보기 토글이 붙고, diff 는 변경 전/후를 오갈 수 있습니다.
- 그 밖의 사이트에서는 페이지의 HTML 소스를 그 자리에 렌더링하고 소스 보기 / 전체화면 / 새 탭 버튼을 제공합니다. .html 링크에는 미리보기 버튼이 붙습니다.
- 렌더링은 확장 자체의 샌드박스 페이지(origin null)에서만 하므로, 미리보기 HTML 의 스크립트는 사이트의 쿠키·DOM·API 에 접근할 수 없습니다. 서버 통신과 데이터 저장이 없습니다.

## 단일 목적 (Single purpose)

> Render HTML source found on web pages (code blocks, .html links, GitLab files) in an isolated preview.

## 권한 사유 (Permission justification)

| 권한 | 사유 |
|---|---|
| `activeTab` | 사용자가 툴바 아이콘을 눌렀을 때 현재 탭의 URL(origin)을 읽어 그 사이트를 켜고 끄기 위해 필요합니다. |
| `scripting` | 사용자가 켠 사이트에만 content script 를 등록(`registerContentScripts`)하고, 켜는 순간 새로고침 없이 주입(`executeScript`)하기 위해 필요합니다. |
| 선택적 호스트 권한 `https://*/*`, `http://*/*` | 사용자가 어떤 사이트에서 쓸지 미리 알 수 없습니다. 권한은 설치 시 요청하지 않고, 사용자가 아이콘을 누른 그 origin 에 대해서만 요청하며, 다시 누르면 제거합니다. 페이지 내용은 브라우저 안에서 HTML 블록을 찾아 렌더링하는 데만 쓰이고 어디로도 전송되지 않습니다. |
| `web_accessible_resources` (`viewer.html`) | 샌드박스 뷰어 페이지를 호스트 페이지 안 iframe 과 새 탭에서 열기 위해 필요합니다. |

원격 코드: 없습니다. 모든 코드는 패키지 안에 있습니다. 샌드박스 뷰어의 CSP 가 https 스크립트를 허용하는 것은 **사용자가 미리보기하는 HTML 문서**(사용자 콘텐츠)가 참조하는 CDN 라이브러리를 그 격리된 문서 안에서 불러오기 위한 것이며, 확장 코드가 원격 스크립트를 로드하는 경우는 없습니다.

## 개인정보 (Privacy practices)

- 수집하는 사용자 데이터: **없음** (개인 식별 정보, 건강, 금융, 인증, 개인 통신, 위치, 웹 기록, 사용자 활동, 웹사이트 콘텐츠 모두 해당 없음)
- 데이터 전송: 없음. 확장은 어떤 원격 서버에도 요청을 보내지 않습니다. (`.html` 링크 미리보기는 사용자의 브라우저가 그 링크를 직접 받아오는 것으로, 확장의 서버는 존재하지 않습니다.)
- 저장: GitLab blob 페이지의 미리보기/소스 모드 선택 1개를 `localStorage` 에 둡니다. 그 외 저장 없음.
- 개인정보 처리방침 URL: 데이터를 수집하지 않으므로 필수는 아니나, 폼에서 요구하면 이 README 의 "보안 모델" 섹션을 공개 페이지로 올려 링크합니다.

## 제출물 체크리스트

- [ ] 개발자 계정 등록 (1회 5달러) — 개인/회사 계정 결정
- [ ] 폴더를 zip 으로 압축 (`.git`, `STORE.md` 제외)
- [ ] 스크린샷 1280×800 또는 640×400, 1~5장: Google Chat 패널, GitLab blob, GitLab diff 변경 전/후
- [ ] 아이콘 128px (`icons/icon128.png`)
- [ ] 위 요약·설명·단일 목적·권한 사유·개인정보 항목 입력
- [ ] 공개 범위 선택 (Unlisted 권장)
- [ ] 심사: 넓은 호스트 권한(선택적)이 있어 보통 수 일 소요
