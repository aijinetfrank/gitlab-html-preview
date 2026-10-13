# GitLab HTML Preview

GitLab 저장소에서 `.html` 파일을 열면 소스 대신 렌더링 결과를 보여주는 Chrome 확장.

## 설치

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** → 이 `extension` 폴더 선택

## 사용

`.html` / `.htm` 파일의 blob 페이지에 들어가면 우측 상단에 버튼 바가 뜬다.

| 버튼 | 동작 |
|---|---|
| 미리보기 / 소스 보기 | 렌더링 ↔ GitLab 원래 소스 뷰 토글 (마지막 선택을 기억) |
| 전체화면 | 렌더링 영역을 전체화면으로 (ESC로 해제) |
| 새 탭 | 렌더링 결과를 새 탭에 연다 |

### diff 페이지 (commit / MR)

`.html` 파일의 diff 헤더마다 **미리보기** 버튼이 붙는다. 삭제된 파일은 변경 전 버전으로 대신 보여준다. 누르면 diff 대신 렌더링이 나오고, 위쪽 툴바로 전환한다.

| 버튼 | 동작 |
|---|---|
| 변경 후 / 변경 전 | 해당 커밋(또는 MR head) ↔ 부모 커밋(또는 MR base) 버전 렌더링 |
| 전체화면 | 렌더링 영역 전체화면 (ESC로 해제) |
| 새 탭 | 지금 보는 버전을 새 탭에 연다 |
| diff 보기 | 원래 diff 로 되돌린다 |

"변경 전" ref 는 GitLab API(`/api/v4/projects/:id/repository/commits/:sha` 또는 `merge_requests/:iid`)로 구하며 로그인 세션을 그대로 쓴다.

## 동작 원리

- 현재 URL의 `/-/blob/`을 `/-/raw/`로 바꿔 로그인 쿠키 그대로 fetch 한다. 토큰 불필요.
- 받은 HTML을 `sandbox` iframe(`srcdoc`)에 넣는다. 같은 origin 권한은 주지 않으므로 문서 안 스크립트가 GitLab 세션에 접근할 수 없다.
- raw 엔드포인트는 HTML을 `text/plain`으로 내려주기 때문에 **상대경로 CSS·이미지는 깨진다.** CDN 등 절대 URL만 참조하는 자기완결형 HTML에서 정상 동작한다.

## 대상 호스트

`manifest.json`의 `matches`에 `gitlab.bodoc.co.kr`, `gitlab.com`이 들어 있다. 다른 인스턴스는 거기에 추가.
