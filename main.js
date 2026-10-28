// HTML Preview Anywhere — 진입점. GitLab 이면 GitLab 모드(blob/diff), 아니면 범용 모드.
// Confluence Cloud 면 범용 모드에 첨부 파일 미리보기(미디어 뷰어)를 더한다.
(() => {
  if (window.__ghpStarted) return;
  window.__ghpStarted = true;
  if (window.__ghp.isGitLab()) window.__ghpGitLab();
  else {
    window.__ghpGeneric();
    if (window.__ghp.isConfluence()) window.__ghpConfluence();
  }
})();
