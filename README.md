# HTML Preview Anywhere

Render HTML source found on any web page — code blocks, pasted markup, `.html` links, and GitLab blobs/diffs — inside an isolated sandbox. Turn it on per site from the toolbar icon. No data leaves the browser.

웹 페이지 안의 HTML 소스(코드 블록, 붙여넣은 본문, `.html` 링크, GitLab blob/diff)를 격리된 샌드박스에서 렌더링해 보여주는 Chrome 확장. 툴바 아이콘으로 사이트별로 켜고 끈다. 데이터는 브라우저 밖으로 나가지 않는다.

## 설치 (개발자 모드)

1. `chrome://extensions` → 우측 상단 **개발자 모드** 켜기
2. **압축해제된 확장 프로그램을 로드합니다** → 이 폴더 선택

## 사용

### 사이트 켜기 / 끄기

기본으로 켜진 사이트는 없다. 쓰고 싶은 사이트 탭에서 **툴바의 확장 아이콘을 클릭** → 권한 허용 → 즉시 적용(새로고침 불필요). 다시 클릭하면 끈다.

- 단위는 origin(`https://호스트/*`)이다. 경로는 보지 않고, 서브도메인은 따로 켠다.
- 켜진 사이트는 아이콘에 `ON` 배지가 뜨고, 브라우저를 다시 켜도 유지된다.
- 허용한 목록: `chrome://extensions` → 세부정보 → **사이트 액세스**.

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

raw 엔드포인트는 HTML을 `text/plain`으로 내려주므로 **상대경로 CSS·이미지는 깨진다.** CDN 등 절대 URL만 참조하는 자기완결형 HTML에서 정상 동작한다.

## 보안 모델

렌더링은 항상 확장 자체의 **sandbox 페이지**(`viewer.html`, manifest `sandbox.pages`)에서 한다. 패널은 그 페이지를 `sandbox` 속성이 붙은 iframe 으로 띄우고, 새 탭은 그 페이지를 직접 연다. 호스트 페이지(content script)는 HTML 문자열을 `postMessage` 로 넘기기만 한다.

- 뷰어의 origin 은 **null** 이다. 렌더링된 HTML 안의 스크립트는 호스트 사이트(GitLab, Google Chat …)의 쿠키·DOM·API 에 접근할 수 없고, 확장 API 도 없다.
- `blob:` URL 이나 `srcdoc` 을 호스트 origin 에서 여는 방식은 쓰지 않는다. 그 방식은 사이트에 올라온 HTML 의 스크립트가 **그 사이트 권한으로 실행되는 XSS** 가 된다.
- 뷰어는 자기를 연 창(parent 또는 opener)에서 온 첫 `ghp-render` 메시지만 받는다.
- 뷰어의 CSP 는 manifest `content_security_policy.sandbox` 에 있다. 인라인 스크립트와 https CDN 스크립트를 허용해서 자기완결형 HTML 덱이 그대로 동작한다. 호스트 페이지의 CSP 는 상속되지 않는다.
- 확장은 어떤 서버와도 통신하지 않고, 아무것도 저장하지 않는다 (GitLab blob 의 미리보기/소스 모드 선택만 `localStorage`).
- 남는 위험은 **패널 안 피싱**(렌더링된 HTML 이 로그인 화면처럼 보이게 꾸미는 것)이다. 패널 안에 입력한 값은 호스트 사이트와 무관하며, 입력하지 않으면 된다.

## 파일

| 파일 | 역할 |
|---|---|
| `manifest.json` | MV3. 고정 호스트 없음, `optional_host_permissions` + `scripting` + `activeTab` |
| `background.js` | 아이콘 클릭 → origin 별 등록/해제(`scripting.registerContentScripts`), `ON` 배지 |
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
