// HTML Preview Anywhere — 공통: 격리된 뷰어 만들기 / 새 탭 열기 / 버튼
// 렌더링은 항상 확장의 sandbox 페이지(viewer.html)에서 한다.
//  - 패널: <iframe src="chrome-extension://…/viewer.html" sandbox>
//  - 새 탭: window.open(viewer.html)
// 둘 다 origin 이 null 이라, 렌더링되는 HTML 의 스크립트는 호스트 사이트(GitLab, Google Chat …)의
// 쿠키·DOM·API 에 접근할 수 없다. (blob:/srcdoc 을 호스트 origin 에서 여는 것은 XSS 가 된다.)
window.__ghp = window.__ghp || (() => {
  const VIEWER = chrome.runtime.getURL("viewer.html");
  const ready = new WeakSet();   // ghp-ready 를 보낸 window
  const pending = new WeakMap(); // window → 보낼 { html, base }
  const viewers = new WeakSet(); // 우리가 그려 준 뷰어 window
  const roots = new WeakMap();   // 우리가 그려 준 뷰어 window → 처음 연 문서의 원본 URL

  const dirOf = (u) => u.pathname.slice(0, u.pathname.lastIndexOf("/") + 1);
  // 뷰어 안 링크로 이 자리에서 다시 그려도 되는 주소: 처음 연 문서와 같은 origin, 같은 폴더(또는 아래)의 .html.
  // 렌더링된 HTML 이 로그인 쿠키로 아무 주소나 읽어 가지 못하게 부모 쪽에서 다시 확인한다.
  function canNavigate(url, root) {
    try {
      const u = new URL(url), b = new URL(root);
      return u.origin === b.origin && /^https?:$/.test(u.protocol) &&
        /\.html?$/i.test(u.pathname) && u.pathname.startsWith(dirOf(b));
    } catch { return false; }
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || !e.source) return;
    if (d.type === "ghp-ready") {
      ready.add(e.source);
      if (pending.has(e.source)) {
        e.source.postMessage({ type: "ghp-render", ...pending.get(e.source) }, "*");
        pending.delete(e.source);
      }
    } else if (d.type === "ghp-open" && typeof d.url === "string") {
      // 패널 안 링크 → 새 탭. 호스트 페이지가 열어야 같은 사이트 이동이라 로그인 쿠키가 다 붙는다.
      if (!viewers.has(e.source) || !/^https?:\/\//i.test(d.url)) return;
      window.open(d.url, "_blank", "noopener");
    } else if (d.type === "ghp-navigate" && typeof d.url === "string") {
      const win = e.source;
      const root = roots.get(win);
      if (!root || !canNavigate(d.url, root)) return;
      fetchText(d.url)
        .then((html) => send(win, html, d.url, root))
        .catch((err) => console.warn("[HTML Preview] 링크를 불러오지 못했습니다", d.url, err));
    }
  });
  // base: 이 HTML 의 원본 URL, root: 링크로 옮겨 다닐 수 있는 범위의 기준 (처음 연 문서)
  function send(win, html, base = null, root = base) {
    if (!win) return;
    viewers.add(win);
    if (root) roots.set(win, root);
    else roots.delete(win);
    if (ready.has(win)) win.postMessage({ type: "ghp-render", html, base, root }, "*");
    else pending.set(win, { html, base, root });
  }

  // 패널용 격리 iframe. render(html) 은 뷰어가 준비되는 대로 전달된다. 다시 그리려면 reset() 후 render().
  function makeFrame() {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.src = VIEWER;
    let rendered = false;
    const reset = () => { rendered = false; ready.delete(iframe.contentWindow); pending.delete(iframe.contentWindow); iframe.src = "about:blank"; iframe.src = VIEWER; };
    return {
      iframe,
      reset,
      render: (html, base) => { if (rendered) reset(); rendered = true; send(iframe.contentWindow, html, base); }, // 두 번째부터는 뷰어를 새로 띄워서 그린다
    };
  }
  // base: 그 HTML 의 원본 URL. 뷰어가 상대경로 링크·이미지를 이 주소 기준으로 푼다.
  function openInNewTab(html, base) {
    const w = window.open(VIEWER, "_blank");
    if (w) send(w, html, base);
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
