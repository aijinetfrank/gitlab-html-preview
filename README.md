# HTML Preview Anywhere

Render HTML source found on any web page — code blocks, pasted markup, `.html` links, and GitLab blobs/diffs — inside an isolated sandbox. Turn it on per site from the toolbar icon. No data leaves the browser.

웹 페이지 안의 HTML 소스(코드 블록, 붙여넣은 본문, `.html` 링크, GitLab blob/diff)를 격리된 샌드박스에서 렌더링해 보여주는 Chrome 확장. 툴바 아이콘으로 사이트별로 켜고 끈다. 데이터는 브라우저 밖으로 나가지 않는다.

## 설치 (개발자 모드)

1. `chrome://extensions` → 우측 상단 **개발자 모드** 켜기
2. **압축해제된 확장 프로그램을 로드합니다** → 이 폴더 선택

## 사용

### 사이트 켜기 / 끄기

기본으로 켜진 사이트는 없다. 쓰고 싶은 사이트 탭에서 **툴바의 확장 아이콘을 클릭** → 권한 허용 → 즉시 적용(새로고침 불필요). 다시 클릭하면 끈다.

- 아이콘 클릭의 단위는 origin(`https://호스트/*`)이다.
- 서브도메인까지 한 번에 켜려면 **옵션 페이지**(아이콘 우클릭 → 옵션)에서 매치 패턴을 넣는다. 예: `https://*.google.com/*` 는 google.com 과 모든 서브도메인. 호스트만 써도(`gitlab.example.com`) `https://…/*` 로 채운다.
- 와일드카드 패턴으로 켜진 사이트에서 아이콘을 누르면 옵션 페이지가 열린다. 끄는 것도 거기서 한다.
- 켜진 사이트는 아이콘에 `ON` 배지가 뜬다. 목록은 `chrome.storage.local` 에 있고, 설치·재로드·브라우저 시작 때마다 그 목록으로 content script 를 다시 등록하므로 확장을 재로드해도 풀리지 않는다.

### 모드는 자동으로 고른다

페이지를 읽을 때 GitLab 인스턴스(gitlab.com, self-hosted 모두)면 **GitLab 모드**, 아니면 **범용 모드**로 동작한다.

### 범용 모드 (Google Chat, 위키, 이슈 트래커 등)

| 대상 | 감지 기준 | 동작 |
|---|---|---|
| HTML 소스 텍스트 | `<pre>`/`<code>` 또는 일반 텍스트가 `<!doctype html` / `<html` 로 시작하고 40자 이상 (여러 줄이 각각 div 로 나뉜 메시지도 하나로 인식) | **그 자리에 바로 렌더링.** 소스는 숨기고 같은 높이의 패널로 바꾼다 |
| `.html` / `.htm` 링크 | 링크 경로의 파일명 또는 링크 텍스트가 `.html`로 끝남 | 링크 뒤에 **미리보기** 버튼. 누르면 로그인 쿠키로 fetch 해서 아래에 렌더링 |

버튼은 모두 블록 우측 상단, 같은 자리에 뜬다.

| 상태 | 버튼 | 동작 |
|---|---|---|
| 미리보기 (기본) | 소스 보기 | 그 블록만 원래 소스로 되돌린다 |
| | 전체화면 | 그 패널을 전체화면으로 (ESC로 해제) |
| | 새 탭 | 그 HTML 을 격리된 새 탭에 연다 |
| 소스 보기 | 미리보기 | 그 블록을 다시 읽어 렌더링한다 |

패널 높이는 원래 소스 블록의 높이(최소 240px, 최대 화면의 85%)를 따른다. 캐시는 없다. SPA 라서 DOM 변화를 감시하며, 사이트가 메시지를 다시 그리면 패널도 따라 다시 붙는다.

### GitLab 모드

`.html` / `.htm` 파일의 **blob 페이지**에 들어가면 우측 상단에 버튼 바가 뜬다.

| 버튼 | 동작 |
|---|---|
| 미리보기 / 소스 보기 | 렌더링 ↔ GitLab 원래 소스 뷰 토글 (마지막 선택을 기억) |
| 전체화면 | 렌더링 영역을 전체화면으로 (ESC로 해제) |
| 새 탭 | 렌더링 결과를 격리된 새 탭에 연다 |

**commit / MR diff 페이지**에서는 `.html` 파일의 diff 헤더마다 **미리보기** 버튼이 붙는다. 누르면 diff 대신 렌더링이 나오고, 위쪽 툴바로 **변경 후 / 변경 전**(부모 커밋 또는 MR base)을 오간다. 삭제된 파일은 변경 전 버전을 보여준다. "변경 전" ref 는 GitLab API(`/api/v4/projects/:id/repository/commits/:sha`, `merge_requests/:iid`)로 구하며 로그인 세션을 그대로 쓴다.

### 미리보기 안의 링크

뷰어는 원본 URL 을 `<base>` 로 넣고 링크 클릭을 직접 처리한다.

| 링크 | 동작 |
|---|---|
| `#앵커` | 그 문서 안에서 스크롤 |
| 처음 연 문서와 같은 폴더(또는 아래)의 `.html` | 같은 패널·탭에서 그 문서로 바꿔 그린다 (`#앵커` 포함) |
| 그 밖의 http(s) 링크, `target="_blank"`, ⌘/Ctrl/Shift 클릭 | 새 탭. GitLab raw 주소는 blob 페이지로 바꿔서 연다 |
| 원본 주소가 없는 블록(붙여넣은 HTML)의 상대경로 | 아무 일도 하지 않는다 |

페이지 스스로 막은 클릭(덱의 슬라이드 이동 등)은 건드리지 않는다.

raw 엔드포인트는 HTML을 `text/plain`으로 내려주므로 상대경로 이미지·CSS 는 `<base>` 로 원본 주소 기준으로 풀리지만, **CSS 는 `text/plain` 이라 막히고, 로그인이 필요한 리포의 이미지는 쿠키가 안 붙어 깨질 수 있다**. CDN 등 절대 URL만 참조하는 자기완결형 HTML에서 정상 동작한다.

## 보안 모델

렌더링은 항상 확장 자체의 **sandbox 페이지**(`viewer.html`, manifest `sandbox.pages`)에서 한다. 패널은 그 페이지를 `sandbox` 속성이 붙은 iframe 으로 띄우고, 새 탭은 그 페이지를 직접 연다. 호스트 페이지(content script)는 HTML 문자열을 `postMessage` 로 넘기기만 한다.

- 뷰어의 origin 은 **null** 이다. 렌더링된 HTML 안의 스크립트는 호스트 사이트(GitLab, Google Chat …)의 쿠키·DOM·API 에 접근할 수 없고, 확장 API 도 없다.
- `blob:` URL 이나 `srcdoc` 을 호스트 origin 에서 여는 방식은 쓰지 않는다. 그 방식은 사이트에 올라온 HTML 의 스크립트가 **그 사이트 권한으로 실행되는 XSS** 가 된다.
- 뷰어는 자기를 연 창(parent 또는 opener)에서 온 `ghp-render` 메시지만 받는다.
- 뷰어 안 링크로 다른 `.html` 을 그 자리에서 불러올 때(`ghp-navigate`), 실제로 읽는 건 content script 다. 그래서 렌더링된 HTML 이 로그인 쿠키로 아무 주소나 읽지 못하게, **처음 연 문서와 같은 origin · 같은 폴더(또는 아래)의 `.html`** 만 허용하고 이 검사를 부모 쪽에서 다시 한다.
- 패널 안 링크의 새 탭은 호스트 페이지(content script)가 연다 (`ghp-open`, http(s) 만). 격리된 뷰어가 직접 열면 다른 사이트에서 온 이동이 되어 `SameSite=Strict` 로그인 쿠키가 빠지고, 열린 GitLab 이 로그인을 다시 요구한다. 새 탭으로 띄운 뷰어 안의 링크는 뷰어가 직접 열기 때문에 이 문제가 남는다.
- 뷰어의 CSP 는 manifest `content_security_policy.sandbox` 에 있다. 인라인 스크립트와 https CDN 스크립트를 허용해서 자기완결형 HTML 덱이 그대로 동작한다. 호스트 페이지의 CSP 는 상속되지 않는다.
- 확장은 어떤 서버와도 통신하지 않는다. 저장하는 건 켜진 사이트 패턴 목록(`chrome.storage.local`)과 GitLab blob 의 미리보기/소스 모드 선택(`localStorage`)뿐이다.
- 남는 위험은 **패널 안 피싱**(렌더링된 HTML 이 로그인 화면처럼 보이게 꾸미는 것)이다. 패널 안에 입력한 값은 호스트 사이트와 무관하며, 입력하지 않으면 된다.

## 파일

| 파일 | 역할 |
|---|---|
| `manifest.json` | MV3. 고정 호스트 없음, `optional_host_permissions` + `scripting` + `activeTab` + `storage` |
| `background.js` | 패턴 목록 → content script 재등록(`scripting.registerContentScripts`), 아이콘 클릭 토글, `ON` 배지 |
| `options.html` / `options.js` | 켜진 사이트 패턴 목록 편집 |
| `preview.js` | 공통: 격리 뷰어 iframe / 새 탭, 버튼, fetch, GitLab 감지 |
| `gitlab.js` | GitLab 모드 (blob / diff) |
| `generic.js` | 범용 모드 |
| `main.js` | 진입점: GitLab 이면 `gitlab.js`, 아니면 `generic.js` |
| `viewer.html` / `viewer.js` | 샌드박스 뷰어 |
| `content.css` | 공통 스타일 |
| `icons/` | 16 / 48 / 128 px |

## 문제가 있을 때

1. 아이콘 배지가 `ON` 인지, `chrome://extensions` 에서 재로드했는지 먼저 확인한다.
2. DevTools 콘솔에서 `__ghpDebug()` 를 치면 마운트된 블록·버튼 위치·후보 수가 나온다. `[HTML Preview]` 디버그 로그도 찍힌다.
3. 확장 로드 시 manifest 의 `content_security_policy.sandbox` 가 거부되면, 그 값에서 `https: http:` 를 지운다. (인라인 스크립트는 여전히 동작하고 CDN 스크립트만 막힌다.)

## 스토어 등록

`STORE.md` 에 등록 문안, 권한 사유, 개인정보 고지가 있다.
