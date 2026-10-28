// HTML Preview Anywhere — 범용 모드 (사이트 구조에 의존하지 않음)
// 페이지를 읽을 때 HTML·Markdown 소스 텍스트(코드 블록, 붙여넣은 본문)를 찾아 그 자리에 바로 렌더링한다. (GitLab blob 방식)
// - 패널 우측 상단 버튼: 소스 보기 / 전체화면 / 새 탭
// - 소스 보기를 누르면 그 블록만 원래 소스로 되돌리고, 같은 자리(블록 우측 상단)에 "미리보기" 버튼을 띄운다
// - 미리보기를 누르면 그 블록을 다시 읽어 렌더링한다 (캐시 없음)
// - .html/.md 링크는 링크 뒤에 "미리보기" 버튼만 두고 누르면 아래에 렌더링
window.__ghpGeneric = () => {
  const { makeFrame, openInNewTab, button, fetchText } = window.__ghp;

  // doctype·<html> 을 생략하고 <head> / <meta charset> 으로 시작하는 문서도 HTML5 로 유효하다
  const HTML_START = /^\s*(<!doctype\s+html|<html[\s>]|<head[\s>]|<meta\s+charset)/i;
  const HTML_HINT = /<!doctype\s+html|<html[\s>]|<head[\s>]|<meta\s+charset/i;
  const FILE_LINK = /\.(html?|md|markdown)$/i;
  const ATTACHMENTS_PAGE = /\/viewpageattachments\.action\b/; // Confluence 첨부 목록 페이지
  // Markdown 은 시작 태그 같은 확실한 신호가 없어 표식(제목·목록·인용·코드펜스·링크·굵게)을 센다.
  // 코드 블록(pre/code) 안에서만 본다 — 일반 텍스트까지 보면 오탐이 너무 많다.
  const MD_HEAD = /^\s{0,3}#{1,6}\s/;
  const MD_BODY = /^\s{0,3}([-*+]\s|\d+[.)]\s|>\s?\S|```)/; // 제목을 뺀 줄 단위 표식
  const MD_INLINE = [/\[[^\]\n]+\]\([^\s)]+\)/, /\*\*[^*\n]+\*\*/]; // 링크, 굵게
  // .md 문서를 직접 연 경우 — 브라우저가 본문 전체를 <pre> 하나로 보여준다. URL 이 말해주므로 휴리스틱 불필요.
  const MD_PAGE = /\.(md|markdown)$/i.test(location.pathname);
  const MIN_LEN = 40;
  const MIN_H = 240;
  const SKIP = "[data-ghp], .ghp-wrap, .ghp-bar, script, style, textarea, input, [contenteditable]";
  const logD = (...a) => console.debug("[HTML Preview]", ...a);

  // ---------- 패널 ----------
  function panel(getHtml, extraButtons = [], base = null, md = false) {
    const wrap = document.createElement("div");
    wrap.className = "ghp-wrap ghp-inline";
    const status = document.createElement("div");
    status.className = "ghp-status";
    const frame = makeFrame();
    const bar = document.createElement("div");
    bar.className = "ghp-bar ghp-bar-inline";
    bar.append(
      ...extraButtons,
      button("전체화면", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else wrap.requestFullscreen?.();
      }),
      button("새 탭", async () => {
        try { openInNewTab(await getHtml(), base, md); }
        catch (e) { status.classList.remove("ghp-hidden"); status.textContent = `불러오지 못했습니다: ${e.message}`; }
      }),
    );
    wrap.append(status, frame.iframe, bar);
    (async () => {
      status.textContent = "불러오는 중…";
      try {
        frame.render(await getHtml(), base, md); // 캐시 없음 — 지금 내용을 그대로
        status.classList.add("ghp-hidden");
      } catch (e) {
        status.textContent = `불러오지 못했습니다: ${e.message}`;
      }
    })();
    return wrap;
  }
  const heightFor = (el) => {
    const h = el.getBoundingClientRect().height;
    return Math.round(h > 0 ? Math.min(Math.max(h, MIN_H), window.innerHeight * 0.85) : window.innerHeight * 0.6);
  };

  // ---------- 마운트 / 해제 (블록별, 같은 자리에서 버튼만 바뀜) ----------
  const mounts = new Map(); // el → 우리가 끼워 넣은 노드 (패널 또는 미리보기 버튼 기준점)

  function mountPreview(el) {
    const md = !isBlockOfHtml(el); // 후보는 HTML 아니면 Markdown
    const wrap = panel(async () => el.textContent, [button("소스 보기", () => toSource(el))], null, md);
    wrap.style.height = `${heightFor(el)}px`; // 아직 소스가 보일 때 높이를 잰다
    el.dataset.ghp = "preview";
    el.classList.add("ghp-hidden");
    el.insertAdjacentElement("afterend", wrap);
    mounts.set(el, wrap);
    logD("preview", el);
  }
  function toSource(el) {
    mounts.get(el)?.remove();
    el.classList.remove("ghp-hidden");
    el.dataset.ghp = "source";
    // 블록 바로 앞에 높이 0 기준점을 두고, 그 우측 상단에 버튼을 띄운다 → 패널 버튼과 같은 자리
    const anchor = document.createElement("div");
    anchor.className = "ghp-anchor";
    const bar = document.createElement("div");
    bar.className = "ghp-bar ghp-bar-inline";
    bar.append(button("미리보기", () => { anchor.remove(); mountPreview(el); }));
    anchor.append(bar);
    el.insertAdjacentElement("beforebegin", anchor);
    mounts.set(el, anchor);
    logD("source mode", el);
  }
  function mountLink(a) {
    a.dataset.ghp = "link";
    const holder = document.createElement("span");
    holder.className = "ghp-wrap ghp-link";
    let wrap = null;
    const btn = button("미리보기", () => {
      if (wrap) { wrap.remove(); wrap = null; btn.textContent = "미리보기"; return; }
      wrap = panel(() => fetchText(a.href), [], a.href);
      wrap.style.height = `${Math.round(window.innerHeight * 0.6)}px`;
      holder.insertAdjacentElement("afterend", wrap);
      btn.textContent = "닫기";
    });
    btn.className = "ghp-inline-btn";
    holder.append(btn);
    a.insertAdjacentElement("afterend", holder);
    mounts.set(a, { remove: () => { holder.remove(); wrap?.remove(); }, isConnected: true });
  }

  // ---------- 후보 수집 ----------
  function isBlockOfHtml(el) {
    const t = el.textContent;
    return t.length >= MIN_LEN && HTML_START.test(t);
  }
  function isBlockOfMd(el) {
    const t = el.textContent;
    if (t.length < MIN_LEN || HTML_HINT.test(t)) return false;
    if (MD_PAGE && el.tagName === "PRE" && el.parentElement === document.body) return true;
    const lines = t.split("\n");
    const marks = lines.filter((l) => MD_BODY.test(l)).length
      + MD_INLINE.filter((re) => re.test(t)).length;
    // "# " 제목으로 시작하면 제목 아닌 표식 하나로 충분.
    // 제목만 더 세면 "# 주석"이 여러 줄인 셸·파이썬 스크립트가 오탐된다.
    if (MD_HEAD.test(lines.find((l) => l.trim()) || "")) return marks >= 1;
    return marks + lines.filter((l) => MD_HEAD.test(l)).length >= 4 && lines.length >= 5;
  }
  function linkFileName(a) {
    try {
      const last = decodeURIComponent(new URL(a.href, location.href).pathname.split("/").pop() || "");
      if (FILE_LINK.test(last)) return last;
    } catch { /* ignore */ }
    const txt = (a.getAttribute("download") || a.textContent || "").trim();
    return FILE_LINK.test(txt) ? txt : null;
  }
  function collect() {
    const root = document.body;
    const text = new Set();
    // (a) 코드 블록
    root.querySelectorAll("pre, code").forEach((el) => {
      if (el.closest(SKIP)) return;
      if (el.tagName === "CODE" && el.closest("pre")) return; // pre 안의 code 는 pre 에서 처리
      if (isBlockOfHtml(el) || isBlockOfMd(el)) text.add(el);
    });
    // (b) 코드 블록이 아닌 곳에 붙여넣은 HTML (여러 줄이 각각의 div 로 나뉜 경우 포함)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (HTML_HINT.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      let el = n.parentElement;
      if (!el || el.closest(SKIP + ", pre, code")) continue;
      while (el && el !== root && !isBlockOfHtml(el)) el = el.parentElement; // 시작 태그를 포함하는 가장 작은 블록 조상
      if (el && el !== root) text.add(el);
    }
    // 다른 후보 안에 들어 있는 후보는 버린다 (여러 줄 메시지에서 둘째 줄이 따로 잡히는 경우)
    const arr = Array.from(text);
    const outer = arr.filter((c) => !arr.some((o) => o !== c && o.contains(c)));
    // (c) .html 링크. Confluence 첨부 링크(viewpageattachments.action?preview=…)는 뺀다 —
    //     가리키는 건 파일이 아니라 첨부 목록 페이지이고, 누르면 뜨는 미디어 뷰어에 미리보기가 붙는다 (confluence.js)
    const links = Array.from(root.querySelectorAll("a[href]"))
      .filter((a) => !a.closest(SKIP) && !ATTACHMENTS_PAGE.test(a.href) && linkFileName(a));
    return { text: outer, links };
  }

  // ---------- 루프: SPA 라서 DOM 변화를 감시 ----------
  let timer = null;
  function scan() {
    if (!document.body) return;
    // 사이트가 메시지를 다시 그려서 원본이 사라졌으면 우리가 넣은 것도 치운다.
    for (const [el, node] of mounts) if (!el.isConnected) { node.remove(); mounts.delete(el); }
    let found;
    try { found = collect(); } catch { return; }
    found.text.forEach(mountPreview);
    found.links.forEach(mountLink);
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 300); };
  // 콘솔에서 __ghpDebug() 로 상태 확인 (안 보일 때 진단용)
  window.__ghpDebug = () => ({
    mounted: Array.from(mounts.keys()).map((el) => ({ tag: el.tagName, mode: el.dataset.ghp, rect: el.getBoundingClientRect().toJSON(), text: el.textContent.slice(0, 60) })),
    bars: Array.from(document.querySelectorAll(".ghp-bar")).map((b) => ({ cls: b.className, rect: b.getBoundingClientRect().toJSON(), hidden: b.classList.contains("ghp-hidden"), display: getComputedStyle(b).display })),
    candidates: (() => { const f = collect(); return { text: f.text.length, links: f.links.length }; })(),
  });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
};
