// HTML Preview Anywhere — 공통: 격리된 뷰어 만들기 / 새 탭 열기 / 버튼
// 렌더링은 항상 확장의 sandbox 페이지(viewer.html)에서 한다.
//  - 패널: <iframe src="chrome-extension://…/viewer.html" sandbox>
//  - 새 탭: window.open(viewer.html)
// 둘 다 origin 이 null 이라, 렌더링되는 HTML 의 스크립트는 호스트 사이트(GitLab, Google Chat …)의
// 쿠키·DOM·API 에 접근할 수 없다. (blob:/srcdoc 을 호스트 origin 에서 여는 것은 XSS 가 된다.)
window.__ghp = window.__ghp || (() => {
  const VIEWER = chrome.runtime.getURL("viewer.html");
  const ready = new WeakSet();   // ghp-ready 를 보낸 window
  const pending = new WeakMap(); // window → 보낼 html

  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "ghp-ready" || !e.source) return;
    ready.add(e.source);
    if (pending.has(e.source)) {
      e.source.postMessage({ type: "ghp-render", html: pending.get(e.source) }, "*");
      pending.delete(e.source);
    }
  });
  function send(win, html) {
    if (!win) return;
    if (ready.has(win)) win.postMessage({ type: "ghp-render", html }, "*");
    else pending.set(win, html);
  }

  // 패널용 격리 iframe. render(html) 은 뷰어가 준비되는 대로 전달된다. 다시 그리려면 reset() 후 render().
  function makeFrame() {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-forms allow-modals");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.src = VIEWER;
    let rendered = false;
    const reset = () => { rendered = false; ready.delete(iframe.contentWindow); pending.delete(iframe.contentWindow); iframe.src = "about:blank"; iframe.src = VIEWER; };
    return {
      iframe,
      reset,
      render: (html) => { if (rendered) reset(); rendered = true; send(iframe.contentWindow, html); }, // 두 번째부터는 뷰어를 새로 띄워서 그린다
    };
  }
  function openInNewTab(html) {
    const w = window.open(VIEWER, "_blank");
    if (w) send(w, html);
  }
  function button(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(e); });
    return b;
  }
  function toggleFullscreen(el) {
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }
  async function fetchText(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  async function fetchJson(url) {
    const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  // GitLab 인스턴스인지 (self-hosted 포함) 페이지 메타로 판별
  const isGitLab = () =>
    !!document.querySelector('meta[property="og:site_name"][content="GitLab"], meta[content="GitLab"][property="og:site_name"]') ||
    /^GitLab\b/.test(document.querySelector('meta[name="description"]')?.content || "") ||
    !!document.querySelector('body.gl-dark, body[data-page^="projects:"], .js-gitlab-root, meta[name="gitlab-"]');

  return { makeFrame, openInNewTab, button, toggleFullscreen, fetchText, fetchJson, isGitLab };
})();
