(function () {
  var STORAGE_KEY = "ocpms_api_base";
  var DEFAULT_REMOTE = "http://127.0.0.1:8000";

  function normalize(url) {
    var s = String(url || "").trim().replace(/\/$/, "");
    return s;
  }

  window.ocpmsGetApiBase = function () {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && stored !== "")
      return normalize(stored) || DEFAULT_REMOTE;
    if (window.location.protocol === "file:") return DEFAULT_REMOTE;
    if (String(window.location.port) === "8000") return "";
    return DEFAULT_REMOTE;
  };

  window.ocpmsSetApiBase = function (url) {
    if (!url) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, normalize(url));
  };

  /** Google Maps JavaScript API key (tracking page). Set in DevTools: localStorage.setItem('ocpms_google_maps_key','YOUR_KEY') or window.OCPMS_GOOGLE_MAPS_KEY before config.js. */
  window.ocpmsGetGoogleMapsApiKey = function () {
    var fromStorage = localStorage.getItem("ocpms_google_maps_key");
    if (fromStorage !== null && String(fromStorage).trim() !== "")
      return String(fromStorage).trim();
    if (typeof window.OCPMS_GOOGLE_MAPS_KEY === "string")
      return window.OCPMS_GOOGLE_MAPS_KEY.trim();
    return "";
  };

  function buildUrl(path) {
    var base = window.ocpmsGetApiBase();
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return base ? base + p : p;
  }

  window.ocpmsFetchJson = async function (path, options) {
    var opts = options || {};
    var r = await fetch(buildUrl(path), {
      method: opts.method || "GET",
      body: opts.body,
      headers: Object.assign(
        { "Content-Type": "application/json" },
        opts.headers || {}
      ),
    });
    if (!r.ok) {
      var text = await r.text();
      var err;
      try {
        var j = JSON.parse(text);
        var d = j.detail;
        if (Array.isArray(d)) {
          err = d
            .map(function (x) {
              return x.msg || JSON.stringify(x);
            })
            .join("; ");
        } else err = d != null ? d : j.message || text;
        if (typeof err === "object") err = JSON.stringify(err);
      } catch (e2) {
        err = text || r.statusText;
      }
      throw new Error(String(err || "Request failed"));
    }
    if (r.status === 204) return null;
    var ct = r.headers.get("content-type") || "";
    if (ct.indexOf("application/json") === -1) return null;
    return r.json();
  };
})();
