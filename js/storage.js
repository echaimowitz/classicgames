/* Tiny localStorage wrapper. Every access is guarded: private browsing or
   blocked storage just means scores aren't remembered, never a crash. */
(function () {
  'use strict';
  const PREFIX = 'cg.';
  function get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }
  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) { /* ignore */ }
  }
  window.CG = window.CG || {};
  CG.store = {
    get, set,
    best: (id) => get('best.' + id, 0),
    setBest: (id, v) => set('best.' + id, v),
  };
})();
