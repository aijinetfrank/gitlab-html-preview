// HTML Preview Anywhere — sandboxed viewer
// manifest 의 "sandbox.pages" 에 등록된 페이지. origin 이 null 이고 확장 API 도 없다.
// 부모(패널 iframe) 또는 opener(새 탭)에게 준비됐다고 알리고, 받은 HTML 로 문서를 통째로 바꾼다.
// HTML 안의 스크립트는 이 격리된 문서 안에서만 실행되며 호스트 사이트의 세션·DOM 에 접근할 수 없다.
(() => {
  const target = window.opener || (window.parent !== window ? window.parent : null);
  if (!target) return;
  let done = false;
  window.addEventListener("message", (e) => {
    if (done || e.source !== target) return;
    const d = e.data;
    if (!d || d.type !== "ghp-render" || typeof d.html !== "string") return;
    done = true;
    document.open();
    document.write(d.html);
    document.close();
  });
  const ping = () => {
    if (done) return;
    target.postMessage({ type: "ghp-ready" }, "*");
    setTimeout(ping, 200);
  };
  ping();
})();
