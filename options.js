// 켜진 사이트 패턴 목록 편집. 저장하면 background.js 가 storage.onChanged 로 다시 등록한다.
const $ = (id) => document.getElementById(id);
const VALID = /^(\*|https?):\/\/(\*|(?:\*\.)?[^/*]+)\/.*$/;

// "gitlab.example.com" 이나 "https://gitlab.example.com" 처럼 줄여 써도 받아 준다
function normalize(input) {
  let p = input.trim();
  if (!p) return null;
  if (!/^[*a-z]+:\/\//i.test(p)) p = "https://" + p;
  if (!/^[^:]+:\/\/[^/]+\//.test(p)) p += "/*";
  return VALID.test(p) ? p : null;
}

async function getPatterns() {
  const { patterns } = await chrome.storage.local.get("patterns");
  return Array.isArray(patterns) ? patterns : [];
}

async function render() {
  const patterns = await getPatterns();
  const list = $("list");
  list.replaceChildren();
  for (const p of patterns) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = p;
    li.append(span);
    if (!(await chrome.permissions.contains({ origins: [p] }).catch(() => false))) {
      const em = document.createElement("em");
      em.textContent = "권한 없음";
      li.append(em);
    }
    const del = document.createElement("button");
    del.textContent = "삭제";
    del.onclick = async () => {
      await chrome.storage.local.set({ patterns: (await getPatterns()).filter((x) => x !== p) });
      await chrome.permissions.remove({ origins: [p] }).catch(() => {});
      render();
    };
    li.append(del);
    list.append(li);
  }
  if (!patterns.length) list.textContent = "아직 없다. 위에서 추가하거나, 사이트에서 툴바 아이콘을 누른다.";
}

$("add").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("msg").textContent = "";
  const p = normalize($("pattern").value);
  if (!p) {
    $("msg").textContent = "패턴 형식이 아니다. 예: https://*.example.com/*";
    return;
  }
  // 사용자 제스처 안에서 바로 요청
  const granted = await chrome.permissions.request({ origins: [p] }).catch((err) => {
    $("msg").textContent = String(err?.message || err);
    return false;
  });
  if (!granted) return;
  const patterns = await getPatterns();
  if (!patterns.includes(p)) await chrome.storage.local.set({ patterns: [...patterns, p] });
  $("pattern").value = "";
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.patterns) render();
});
render();
