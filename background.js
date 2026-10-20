// HTML Preview Anywhere — service worker
// 켜진 사이트는 매치 패턴 목록(chrome.storage.local "patterns")이 정본이다.
// - 툴바 아이콘 클릭 → 현재 탭의 origin 패턴(https://호스트/*)을 넣거나 뺀다.
// - 옵션 페이지 → https://*.example.com/* 같은 와일드카드 패턴을 직접 넣는다.
// 동적 content script 는 확장 재로드·업데이트 때 지워질 수 있으므로,
// 설치·시작·목록 변경 때마다 목록에서 다시 등록한다 (sync).
// 모든 확장 API 호출은 실패해도 서비스 워커 에러로 남지 않도록 감싼다 (닫힌 탭, 권한 거부 등).

// 순서 중요: 공통 → 모드별 → 진입점
const SCRIPTS = ["preview.js", "gitlab.js", "generic.js", "main.js"];
const CSS = ["content.css"];
const SCRIPT_ID = "ghp";
const patternFor = (origin) => origin + "/*";

const originOf = (url) => {
  try {
    const u = new URL(url || "");
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
};

// 매치 패턴(scheme://host/path)을 URL 에 맞춰 본다. host 의 "*." 는 그 도메인 자신과 모든 서브도메인.
function matches(pattern, url) {
  const m = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*]+)(\/.*)$/.exec(pattern);
  if (!m) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  const [, scheme, host, path] = m;
  const proto = u.protocol.slice(0, -1);
  if (scheme === "*" ? !/^https?$/.test(proto) : proto !== scheme) return false;
  if (host !== "*") {
    if (host.startsWith("*.")) {
      const base = host.slice(2);
      if (u.hostname !== base && !u.hostname.endsWith("." + base)) return false;
    } else if (u.hostname !== host) return false;
  }
  const re = new RegExp("^" + path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return re.test(u.pathname + u.search);
}

async function getPatterns() {
  const { patterns } = await chrome.storage.local.get("patterns").catch(() => ({}));
  return Array.isArray(patterns) ? patterns : [];
}

async function setPatterns(patterns) {
  await chrome.storage.local.set({ patterns: [...new Set(patterns)] });
  // sync 는 storage.onChanged 에서 돈다 (옵션 페이지에서 바꿔도 같은 경로)
}

// 예전 버전이 origin 마다 따로 등록한 "generic:<origin>" 스크립트를 목록으로 옮긴다.
async function migrate() {
  const { migrated } = await chrome.storage.local.get("migrated").catch(() => ({}));
  if (migrated) return;
  const old = await chrome.scripting.getRegisteredContentScripts().catch(() => []);
  const legacy = old.filter((s) => s.id.startsWith("generic:")).flatMap((s) => s.matches || []);
  await chrome.storage.local.set({ patterns: [...new Set([...(await getPatterns()), ...legacy])], migrated: true });
}

let syncing = Promise.resolve();
function sync() {
  syncing = syncing.then(async () => {
    const patterns = await getPatterns();
    // 권한이 빠진 패턴은 등록해도 동작하지 않으므로 거른다 (chrome://extensions 에서 사이트 액세스를 뺀 경우)
    const allowed = [];
    for (const p of patterns) {
      if (await chrome.permissions.contains({ origins: [p] }).catch(() => false)) allowed.push(p);
    }
    const ids = (await chrome.scripting.getRegisteredContentScripts().catch(() => [])).map((s) => s.id);
    if (ids.length) await chrome.scripting.unregisterContentScripts({ ids }).catch(() => {});
    if (!allowed.length) return;
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID,
      matches: allowed,
      js: SCRIPTS,
      css: CSS,
      runAt: "document_idle",
      allFrames: true,
      persistAcrossSessions: true,
    }]).catch((e) => console.warn("[HTML Preview] registerContentScripts 실패", e));
  }).catch((e) => console.warn("[HTML Preview] sync 실패", e));
  return syncing;
}

async function inject(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: CSS }).catch(() => {});
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: SCRIPTS }).catch(() => {});
}

async function refreshBadge(tabId, url) {
  if (tabId == null) return;
  const patterns = await getPatterns();
  const text = url && patterns.some((p) => matches(p, url)) ? "ON" : "";
  // 탭이 이미 닫혔으면 "No tab with id" 로 거부되므로 삼킨다
  await chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#3b82f6" }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => { migrate().then(sync); });
chrome.runtime.onStartup.addListener(() => { sync(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.patterns) sync();
});
chrome.permissions.onAdded.addListener(() => { sync(); });
chrome.permissions.onRemoved.addListener(() => { sync(); });

chrome.action.onClicked.addListener((tab) => {
  (async () => {
    const origin = originOf(tab?.url);
    if (!origin) return;
    const own = patternFor(origin);
    // permissions.request 는 사용자 제스처 안에서 호출해야 하므로 다른 await 보다 먼저 부른다.
    // (이미 허용된 origin 이면 프롬프트 없이 바로 true)
    const requesting = chrome.permissions.request({ origins: [own] }).catch(() => false);
    const patterns = await getPatterns();
    if (patterns.includes(own)) {
      await setPatterns(patterns.filter((p) => p !== own));
    } else if (patterns.some((p) => matches(p, tab.url))) {
      // 와일드카드 패턴으로 켜진 사이트 — 끄는 건 옵션 페이지에서
      chrome.runtime.openOptionsPage();
    } else if (await requesting) {
      await setPatterns([...patterns, own]);
      await inject(tab.id); // 새로고침 없이 바로 적용
    }
    await refreshBadge(tab.id, tab.url);
  })().catch((e) => console.warn("[HTML Preview] onClicked 실패", e));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId)
    .then((tab) => refreshBadge(tabId, tab?.url))
    .catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" || info.url) {
    refreshBadge(tabId, tab?.url).catch(() => {});
  }
});
