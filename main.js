// HTML Preview Anywhere — 진입점. GitLab 이면 GitLab 모드(blob/diff), 아니면 범용 모드.
(() => {
  if (window.__ghpStarted) return;
  window.__ghpStarted = true;
  if (window.__ghp.isGitLab()) window.__ghpGitLab();
  else window.__ghpGeneric();
})();
