// GoatCounter analytics — loaded only when site.goatcounterUrl is set
// The Nunjucks template passes the URL via a data attribute on the script tag.
(function () {
  var gcUrl = document.currentScript ? document.currentScript.dataset.gc : null;
  if (!gcUrl) return;
  var s = document.createElement("script");
  s.src = gcUrl + "/count.js";
  s.async = true;
  s.dataset.goatcounter = gcUrl;
  document.head.appendChild(s);
})();
