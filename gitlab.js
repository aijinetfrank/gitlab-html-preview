// HTML Preview Anywhere — GitLab 모드 (gitlab.com 및 self-hosted)
// 1) blob 페이지: .html 파일이면 소스 대신 렌더링 (우측 상단 플로팅 바)
// 2) commit / MR diff 페이지: .html 파일마다 헤더에 "미리보기" 버튼 → 변경 후/전 렌더링
// 렌더링은 공통 모듈(preview.js)의 격리 뷰어에서 한다.
window.__ghpGitLab = () => {
  const { makeFrame, openInNewTab, button, toggleFullscreen, fetchText, fetchJson } = window.__ghp;
  const MODE_KEY = "ghp:mode"; // blob 페이지 기본 모드: "preview" | "source"
  const HTML_RE = /\.html?$/i;
  const CONTENT_SELECTORS = [
    '[data-testid="blob-viewer-file-content"]',
    ".blob-viewer",
    ".file-content",
    ".blob-content",
  ];

  // ---------- 공통 ----------
  const projectPath = () => location.pathname.split("/-/")[0].replace(/^\//, "");
  const apiProject = () => `${location.origin}/api/v4/projects/${encodeURIComponent(projectPath())}`;
  const rawUrlFor = (ref, path) =>
    `${location.origin}/${projectPath()}/-/raw/${ref}/${path.split("/").map(encodeURIComponent).join("/")}`;

  // ---------- 1) blob 페이지 ----------
  let blob = null; // { wrap, frame, bar, btnToggle, btnFull, hidden, loaded }

  const isHtmlBlob = () => /\/-\/blob\/.+\.html?$/i.test(location.pathname);
  const blobRawUrl = () =>
    location.origin + location.pathname.replace("/-/blob/", "/-/raw/") + location.search;
  const findBlobContents = () =>
    CONTENT_SELECTORS.flatMap((s) => Array.from(document.querySelectorAll(s)));

  function blobTeardown() {
    if (!blob) return;
    blob.hidden.forEach((el) => el.classList.remove("ghp-hidden"));
    blob.wrap?.remove();
    blob.bar?.remove();
    blob = null;
  }

  function blobSetMode(mode) {
    if (!blob) return;
    localStorage.setItem(MODE_KEY, mode);
    const preview = mode === "preview";
    blob.hidden.forEach((el) => el.classList.toggle("ghp-hidden", preview));
    blob.wrap.classList.toggle("ghp-hidden", !preview);
    blob.btnToggle.textContent = preview ? "소스 보기" : "미리보기";
    blob.btnToggle.classList.toggle("ghp-active", preview);
    blob.btnFull.disabled = !preview;
    if (preview && !blob.loaded) blobLoad();
  }

  async function blobLoad() {
    const status = blob.wrap.querySelector(".ghp-status");
    status.textContent = "불러오는 중…";
    try {
      blob.frame.render(await fetchText(blobRawUrl()), blobRawUrl());
      status.remove();
      blob.loaded = true;
    } catch (e) {
      status.textContent = `불러오지 못했습니다: ${e.message}`;
    }
  }

  function blobMount() {
    const holder =
      document.querySelector(".file-holder") ||
      CONTENT_SELECTORS.map((s) => document.querySelector(s)).find(Boolean)?.parentElement;
    if (!holder) return false;

    const wrap = document.createElement("div");
    wrap.className = "ghp-wrap";
    const status = document.createElement("div");
    status.className = "ghp-status";
    const frame = makeFrame();
    wrap.append(status, frame.iframe);
    holder.insertAdjacentElement("afterend", wrap);

    const bar = document.createElement("div");
    bar.className = "ghp-bar";
    const btnToggle = button("", () =>
      blobSetMode(blob.wrap.classList.contains("ghp-hidden") ? "preview" : "source"));
    const btnFull = button("전체화면", () => toggleFullscreen(wrap));
    const btnTab = button("새 탭", async () => {
      try { openInNewTab(await fetchText(blobRawUrl()), blobRawUrl()); }
      catch (e) { alert(`불러오지 못했습니다: ${e.message}`); }
    });
    bar.append(btnToggle, btnFull, btnTab);
    document.body.append(bar);

    blob = { wrap, frame, bar, btnToggle, btnFull, hidden: findBlobContents(), loaded: false };
    blobSetMode(localStorage.getItem(MODE_KEY) || "preview");
    return true;
  }

  // ---------- 2) diff 페이지 (commit / MR) ----------
  const isDiffPage = () =>
    /\/-\/(commit\/[0-9a-f]+|merge_requests\/\d+)/i.test(location.pathname);

  // 변경 후/전 ref 는 페이지 단위로 한 번만 구한다.
  let refsPromise = null;
  function getRefs() {
    if (refsPromise) return refsPromise;
    refsPromise = (async () => {
      const commit = location.pathname.match(/\/-\/commit\/([0-9a-f]{7,40})/i);
      if (commit) {
        const sha = commit[1];
        let before = null;
        try {
          const info = await fetchJson(`${apiProject()}/repository/commits/${sha}`);
          before = info.parent_ids?.[0] || null;
        } catch { /* 부모를 못 구하면 "변경 전" 비활성 */ }
        return { after: sha, before };
      }
      const mr = location.pathname.match(/\/-\/merge_requests\/(\d+)/);
      if (mr) {
        const info = await fetchJson(`${apiProject()}/merge_requests/${mr[1]}`);
        const r = info.diff_refs || {};
        return { after: r.head_sha || info.sha, before: r.base_sha || null };
      }
      throw new Error("ref를 알 수 없음");
    })();
    refsPromise.catch(() => { refsPromise = null; });
    return refsPromise;
  }

  // diff-file 요소에서 파일 경로를 뽑는다. (data-path → 제목 title → "View file" 링크)
  function diffFilePath(file) {
    if (file.dataset.path) return file.dataset.path;
    const t = file.querySelector(".file-title-name[title], [data-testid='file-title-name'], .file-title-name");
    if (t) return (t.getAttribute("title") || t.textContent).trim();
    const link = file.querySelector('a[href*="/-/blob/"]');
    if (link) {
      const m = new URL(link.href).pathname.match(/\/-\/blob\/[0-9a-f]{7,40}\/(.+)$/i);
      if (m) return decodeURIComponent(m[1]);
    }
    return null;
  }
  function diffFileOldPath(file) {
    return file.dataset.oldPath || null;
  }

  function diffMount(file) {
    file.dataset.ghp = "1";
    const path = diffFilePath(file);
    if (!path || !HTML_RE.test(path)) return;

    const header =
      file.querySelector(".js-file-title, .file-title, .file-title-flex-parent, [data-testid='file-title']") ||
      file.firstElementChild;
    const actions = file.querySelector(".file-actions") || header;
    const content = file.querySelector(".diff-content") ||
      Array.from(file.children).find((c) => c !== header);
    if (!header) return;

    const wrap = document.createElement("div");
    wrap.className = "ghp-wrap ghp-diff ghp-hidden";
    const toolbar = document.createElement("div");
    toolbar.className = "ghp-toolbar";
    const status = document.createElement("div");
    status.className = "ghp-status";
    const frame = makeFrame();
    wrap.append(toolbar, status, frame.iframe);
    header.insertAdjacentElement("afterend", wrap);

    const cache = {}; // side → html
    const urls = {};  // side → raw URL (뷰어가 상대경로 링크를 푸는 기준)
    let side = "after";

    async function show(which) {
      side = which;
      btnAfter.classList.toggle("ghp-active", which === "after");
      btnBefore.classList.toggle("ghp-active", which === "before");
      status.classList.remove("ghp-hidden");
      status.textContent = "불러오는 중…";
      try {
        if (!cache[which]) {
          const refs = await getRefs();
          const ref = refs[which];
          if (!ref) throw new Error(which === "before" ? "변경 전 버전이 없습니다 (새 파일)" : "ref 없음");
          const p = which === "before" ? (diffFileOldPath(file) || path) : path;
          urls[which] = rawUrlFor(ref, p);
          cache[which] = await fetchText(urls[which]);
        }
        frame.render(cache[which], urls[which]);
        status.classList.add("ghp-hidden");
      } catch (e) {
        // 삭제된 파일: 변경 후가 404면 변경 전 버전으로 대신 보여준다.
        if (which === "after" && /404/.test(e.message)) {
          await show("before");
          if (cache.before) {
            status.classList.remove("ghp-hidden");
            status.textContent = "삭제된 파일입니다 — 변경 전 버전을 표시합니다.";
          }
          return;
        }
        frame.reset();
        status.textContent = `불러오지 못했습니다: ${e.message}`;
      }
    }

    const btnAfter = button("변경 후", () => show("after"));
    const btnBefore = button("변경 전", () => show("before"));
    const btnFull = button("전체화면", () => toggleFullscreen(wrap));
    const btnTab = button("새 탭", async () => {
      try {
        if (!cache[side]) await show(side);
        if (cache[side]) openInNewTab(cache[side], urls[side]);
      } catch (e) { alert(`불러오지 못했습니다: ${e.message}`); }
    });
    toolbar.append(btnAfter, btnBefore, btnFull, btnTab);

    let open = false;
    const btnToggle = button("미리보기", () => {
      open = !open;
      wrap.classList.toggle("ghp-hidden", !open);
      content?.classList.toggle("ghp-hidden", open);
      btnToggle.textContent = open ? "diff 보기" : "미리보기";
      btnToggle.classList.toggle("ghp-active", open);
      if (open && !cache[side]) show(side);
    });
    btnToggle.className = "ghp-inline-btn";
    actions.insertAdjacentElement(actions === header ? "beforeend" : "afterbegin", btnToggle);
  }

  function diffScan() {
    document.querySelectorAll(".diff-file:not([data-ghp])").forEach(diffMount);
  }

  // ---------- 루프: GitLab은 pushState로 이동하므로 URL과 DOM을 주기적으로 확인 ----------
  let lastHref = "";
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      blobTeardown();
      refsPromise = null;
    }
    if (isHtmlBlob()) {
      if (!blob) blobMount();
      if (blob && !blob.wrap.classList.contains("ghp-hidden")) {
        findBlobContents().forEach((el) => {
          if (!blob.hidden.includes(el)) { blob.hidden.push(el); el.classList.add("ghp-hidden"); }
        });
      }
    }
    if (isDiffPage()) diffScan();
  }, 500);
};
