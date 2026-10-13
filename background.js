// HTML Preview Anywhere — service worker
// 툴바 아이콘 클릭 → 현재 탭의 사이트에서 generic.js 를 켜거나 끈다.
// 켠 사이트는 chrome.scripting.registerContentScripts 로 등록되어 브라우저를 다시 켜도 유지된다.

const STATIC = (chrome.runtime.getManifest().content_scripts || []).flatMap((cs) => cs.matches);

const patternToRegex = (p) =>
  new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const isStatic = (url) => STATIC.some((p) => patternToRegex(p).test(url));

// 순서 중요: 공통 → 모드별 → 진입점
const SCRIPTS = ["preview.js", "gitlab.js", "generic.js", "main.js"];
const idFor = (origin) => "generic:" + origin;
const patternFor = (origin) => origin + "/*";

async function isEnabled(origin) {
  const [s] = await chrome.scripting.getRegisteredContentScripts({ ids: [idFor(origin)] });
  return Boolean(s);
}

async function enable(origin, tabId) {
  await chrome.scripting.registerContentScripts([{
    id: idFor(origin),
    matches: [patternFor(origin)],
    js: SCRIPTS,
    css: ["content.css"],
    runAt: "document_idle",
    allFrames: true,
    persistAcrossSessions: true,
  }]);
  // 새로고침 없이 바로 적용
  await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: ["content.css"] }).catch(() => {});
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: SCRIPTS }).catch(() => {});
}

async function disable(origin) {
  await chrome.scripting.unregisterContentScripts({ ids: [idFor(origin)] }).catch(() => {});
  await chrome.permissions.remove({ origins: [patternFor(origin)] }).catch(() => {});
}

async function refreshBadge(tabId, url) {
  let text = "";
  try {
    if (url && /^https?:/.test(url)) {
      const origin = new URL(url).origin;
      if (isStatic(url) || (await isEnabled(origin))) text = "ON";
    }
  } catch { /* chrome:// 등 */ }
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#3b82f6" });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !/^https?:/.test(tab.url)) return;
  if (isStatic(tab.url)) return; // manifest 에 고정된 사이트는 항상 켜짐
  const origin = new URL(tab.url).origin;
  // permissions.request 는 사용자 제스처 안에서 호출해야 하므로 다른 await 보다 먼저 부른다.
  // (이미 허용된 origin 이면 프롬프트 없이 바로 true)
  const granted = await chrome.permissions.request({ origins: [patternFor(origin)] });
  if (await isEnabled(origin)) await disable(origin);
  else if (granted) await enable(origin, tab.id);
  refreshBadge(tab.id, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) refreshBadge(tabId, tab.url);
});
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" || info.url) refreshBadge(tabId, tab.url);
});
