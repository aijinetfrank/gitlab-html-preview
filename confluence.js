// HTML Preview Anywhere — Confluence Cloud 첨부 파일 (범용 모드 위에 더한다)
// 미디어 뷰어(첨부 파일을 누르면 뜨는 오버레이)가 .html 첨부를 열면, Confluence 의 소스 코드 뷰 위에 렌더링을 덮는다.
//  - 버튼: 소스 보기 ↔ 미리보기 / 전체화면 / 새 탭
//  - 파일은 페이지 id + 뷰어의 파일명으로 찾는다: /wiki/download/attachments/<pageId>/<파일명>
//    (한 페이지 안에서 첨부 파일명은 겹치지 않는다)
window.__ghpConfluence = () => {
  const { makeFrame, openInNewTab, button, toggleFullscreen, fetchText } = window.__ghp;
  const POPUP = '[data-testid="media-viewer-popup"]';
  const FILE_NAME = '[data-testid="media-viewer-file-name"]';
  const HTML_FILE = /\.html?$/i;

  let mounted = null; // 지금 미디어 뷰어에 붙어 있는 것: { popup, url, wrap, bar }

  // 페이지 보기(/wiki/spaces/<키>/pages/<id>/…) 또는 첨부 목록(viewpageattachments.action?pageId=<id>)
  const pageId = () =>
    location.pathname.match(/\/pages\/(\d+)/)?.[1] || new URLSearchParams(location.search).get("pageId");
  const attachmentUrl = (name) =>
    `${location.origin}/wiki/download/attachments/${pageId()}/${encodeURIComponent(name)}`;

  // 뷰어 머리말(파일명·다운로드·닫기)의 아래쪽 경계. 파일명에서 위로 올라가며 화면의 30% 를 넘지 않는 가장 큰 조상이 머리말이다.
  function headerBottom(popup, nameEl) {
    const limit = popup.getBoundingClientRect().height * 0.3;
    let header = nameEl;
    for (let el = nameEl.parentElement; el && el !== popup && el.getBoundingClientRect().height <= limit; el = el.parentElement) header = el;
    return Math.round(header.getBoundingClientRect().bottom);
  }

  function teardown() {
    mounted?.wrap.remove();
    mounted?.bar.remove();
    mounted = null;
  }

  function mount(popup, nameEl, url) {
    const top = headerBottom(popup, nameEl);
    const wrap = document.createElement("div");
    wrap.className = "ghp-wrap ghp-confluence";
    wrap.style.top = `${top}px`;
    // 뷰어는 빈 곳을 누르면 닫힌다 — 패널 안 클릭이 뷰어까지 올라가지 않게 한다
    wrap.addEventListener("click", (e) => e.stopPropagation());
    const status = document.createElement("div");
    status.className = "ghp-status";
    status.textContent = "불러오는 중…";
    const frame = makeFrame();
    wrap.append(status, frame.iframe);

    const htmlPromise = fetchText(url); // 한 번만 받는다 — 새 탭도 이걸 쓴다
    (async () => {
      try {
        frame.render(await htmlPromise, url);
        status.classList.add("ghp-hidden");
      } catch (e) {
        status.textContent = `불러오지 못했습니다: ${e.message}`;
      }
    })();

    // 미리보기 ↔ 소스 보기: 소스 보기는 패널을 숨겨서 Confluence 의 소스 코드 뷰를 드러낸다
    function setPreview(preview) {
      wrap.classList.toggle("ghp-hidden", !preview);
      btnToggle.textContent = preview ? "소스 보기" : "미리보기";
      btnToggle.classList.toggle("ghp-active", preview);
      btnFull.disabled = !preview;
    }

    const bar = document.createElement("div");
    bar.className = "ghp-bar";
    bar.style.top = `${top + 8}px`;
    const btnToggle = button("", () => setPreview(wrap.classList.contains("ghp-hidden")));
    const btnFull = button("전체화면", () => toggleFullscreen(wrap));
    const btnTab = button("새 탭", async () => {
      try { openInNewTab(await htmlPromise, url); }
      catch (e) { alert(`불러오지 못했습니다: ${e.message}`); } // 소스 보기 중이면 패널의 status 가 안 보인다
    });
    bar.append(btnToggle, btnFull, btnTab);
    setPreview(true);

    popup.append(wrap, bar);
    mounted = { popup, url, wrap, bar };
  }

  // ---------- 루프: 뷰어는 열고 닫히고, 열린 채로 다른 첨부로 넘어가기도 한다 ----------
  setInterval(() => {
    const popup = document.querySelector(POPUP);
    const nameEl = popup?.querySelector(FILE_NAME);
    const name = nameEl?.textContent.trim() || "";
    const url = HTML_FILE.test(name) && pageId() ? attachmentUrl(name) : null;
    if (mounted && (mounted.popup !== popup || mounted.url !== url || !mounted.wrap.isConnected)) teardown();
    if (url && !mounted) mount(popup, nameEl, url);
  }, 500);
};
