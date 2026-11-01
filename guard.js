(function () {
  'use strict';

  if (window.top !== window.self) {
    try { window.top.location = window.self.location; } catch (e) { document.documentElement.innerHTML = ''; }
  }

  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var ctrl = e.ctrlKey || e.metaKey;
    var blocked =
      e.key === 'F12' ||
      (ctrl && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
      (ctrl && e.altKey && (k === 'i' || k === 'j' || k === 'u')) ||
      (ctrl && (k === 'u' || k === 's'));
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('contextmenu', function (e) {
    if (e.target.tagName !== 'TEXTAREA') e.preventDefault();
  });

  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
})();
