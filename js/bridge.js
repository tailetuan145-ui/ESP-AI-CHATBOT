/* Compatibility adapter for existing google.script.run calls.
   It retains the original chaining API so UI code and event handlers need not change. */
(function () {
  'use strict';
  const uidKey = 'esp_client_id';
  let clientId = sessionStorage.getItem(uidKey);
  if (!clientId) {
    clientId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2));
    sessionStorage.setItem(uidKey, clientId);
  }
  const allowed = new Set(['indexSend', 'lookupMeaning', 'lookupMeaningOrFlashcard',
    'getVocabularyImage', 'getVocabularyCatalog', 'generatePractice', 'replyPractice',
    'lookupWordInContext', 'getMeaningAudio']);
  function request(method, args) {
    const base = window.ESP_CONFIG && window.ESP_CONFIG.apiUrl;
    if (!base || base.includes('REPLACE-WITH-YOUR-WORKER')) {
      return Promise.reject(new Error('Chưa cấu hình địa chỉ Cloudflare Worker trong js/config.js'));
    }
    if (!allowed.has(method)) return Promise.reject(new Error('Phương thức chưa được hỗ trợ: ' + method));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), window.ESP_CONFIG.timeoutMs || 90000);
    return fetch(base.replace(/\/$/, '') + '/api', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({action:method, args:args, clientId:clientId}),
      signal:controller.signal
    }).then(async resp => {
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.error || 'HTTP ' + resp.status);
      return data.data;
    }).finally(() => clearTimeout(timer));
  }
  const builder = (success, failure) => new Proxy({
    withSuccessHandler(fn) { return builder(fn, failure); },
    withFailureHandler(fn) { return builder(success, fn); }
  }, {get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop === 'string') return (...args) => {
      request(prop, args).then(v => {if (success) success(v);}, e => {if (failure) failure(e); else console.error(e);});
    };
  }});
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = builder(null,null);
})();
