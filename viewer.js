// HTML Preview Anywhere — sandboxed viewer
// manifest 의 "sandbox.pages" 에 등록된 페이지. origin 이 null 이고 확장 API 도 없다.
// 부모(패널 iframe) 또는 opener(새 탭)에게 준비됐다고 알리고, 받은 HTML 로 문서를 통째로 바꾼다.
// HTML 안의 스크립트는 이 격리된 문서 안에서만 실행되며 호스트 사이트의 세션·DOM 에 접근할 수 없다.
//
// 링크: 문서 주소가 chrome-extension://…/viewer.html 이라 그냥 두면 상대경로가 확장 안으로 풀린다.
// 원본 URL(base)을 <base> 로 넣고, 클릭은 직접 처리한다.
//  - #앵커        → 이 문서 안에서 스크롤
//  - 처음 연 문서와 같은 폴더(또는 아래)의 .html → 부모에게 부탁해 이 자리에서 다시 그린다 (ghp-navigate)
//  - 그 밖의 http(s) → 새 탭 (GitLab raw 주소는 blob 페이지로 바꿔서 연다)
(() => {
  const target = window.opener || (window.parent !== window ? window.parent : null);
  if (!target) return;
  let started = false;
  let base = null;
  let root = null;

  const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  function withBase(html, url) {
    if (!url || /<base[\s>]/i.test(html)) return html;
    const tag = `<base href="${escAttr(url)}">`;
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + tag);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + `<head>${tag}</head>`);
    return tag + html;
  }

  const dirOf = (u) => u.pathname.slice(0, u.pathname.lastIndexOf("/") + 1);
  function inPlace(url) {
    if (!root) return false;
    const b = new URL(root);
    return url.origin === b.origin && /\.html?$/i.test(url.pathname) && url.pathname.startsWith(dirOf(b));
  }
  // 새 탭은 패널이면 부모(호스트 페이지)가 연다. 격리된 뷰어(origin null)가 직접 열면 브라우저가
  // 다른 사이트에서 온 이동으로 보고 SameSite=Strict 로그인 쿠키를 빼서, 열린 GitLab 이 로그인을 다시 요구한다.
  // 클릭의 사용자 활성화는 부모 프레임까지 올라가므로 부모의 window.open 도 팝업 차단에 걸리지 않는다.
  // 새 탭으로 띄운 뷰어는 opener 가 다른 탭이라 활성화가 없으므로 직접 연다.
  const openTab = (u) => {
    if (window.parent !== window) target.postMessage({ type: "ghp-open", url: u }, "*");
    else window.open(u, "_blank", "noopener");
  };
  // GitLab raw 는 text/plain 이라 탭에서 소스만 보인다 → blob 페이지로 연다 (켜진 사이트면 거기서 미리보기)
  const forTab = (url) => {
    const u = new URL(url);
    u.pathname = u.pathname.replace("/-/raw/", "/-/blob/");
    return u.href;
  };

  function scrollToHash(hash) {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return window.scrollTo(0, 0);
    (document.getElementById(id) || document.getElementsByName(id)[0])?.scrollIntoView();
  }

  // 페이지 자체의 핸들러(덱의 슬라이드 이동 등)가 먼저 돌도록 버블 단계에서, 막지 않은 클릭만 처리
  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = e.target.closest?.("a[href]");
    if (!a) return;
    const href = a.getAttribute("href").trim();
    if (href.startsWith("#")) {
      e.preventDefault();
      scrollToHash(href);
      return;
    }
    let url;
    try { url = new URL(href, base || undefined); } catch { e.preventDefault(); return; }
    if (url.protocol === "mailto:" || url.protocol === "tel:") return;
    e.preventDefault();
    if (!/^https?:$/.test(url.protocol)) return; // 원본 주소를 모르는 상대경로 등 — 갈 곳이 없다
    // 같은 문서의 #앵커를 절대 주소로 쓴 경우
    if (base && url.hash && url.href.split("#")[0] === base.split("#")[0]) return scrollToHash(url.hash);
    const newTab = a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey;
    if (!newTab && inPlace(url)) target.postMessage({ type: "ghp-navigate", url: url.href }, "*");
    else openTab(forTab(url.href));
  }

  function render(html, url, rootUrl) {
    base = typeof url === "string" ? url : null;
    root = typeof rootUrl === "string" ? rootUrl : base;
    document.open();
    document.write(withBase(html, base));
    document.close();
    // document.open() 이 window·document 의 리스너를 지우므로 매번 다시 단다
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick);
    if (base && new URL(base).hash) scrollToHash(new URL(base).hash);
  }

  function onMessage(e) {
    if (e.source !== target) return;
    const d = e.data;
    if (!d || d.type !== "ghp-render" || typeof d.html !== "string") return;
    started = true;
    render(d.html, d.base, d.root);
  }
  window.addEventListener("message", onMessage);

  const ping = () => {
    if (started) return;
    target.postMessage({ type: "ghp-ready" }, "*");
    setTimeout(ping, 200);
  };
  ping();
})();
