(function () {
  var form = document.getElementById("trackingForm");
  var resultDiv = document.getElementById("trackingResult");
  var historyList = document.getElementById("trackingHistoryList");
  var clickedMsg = document.getElementById("trackingHistoryClickedMsg");
  var CLICKED_KEY = "ocpms_clicked_order_ref";
  if (!form || !resultDiv) return;

  var mapsScriptPromise = null;

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function hasValidCoords(data) {
    var n = ["rider_lat", "rider_lng", "destination_lat", "destination_lng"];
    for (var i = 0; i < n.length; i++) {
      var v = data[n[i]];
      if (typeof v !== "number" || v !== v) return false;
    }
    return true;
  }

  function loadGoogleMapsOnce(apiKey) {
    if (window.google && window.google.maps) {
      return Promise.resolve();
    }
    if (mapsScriptPromise) return mapsScriptPromise;
    mapsScriptPromise = new Promise(function (resolve, reject) {
      var cb = "__ocpmsGmapsCb";
      window[cb] = function () {
        try {
          delete window[cb];
        } catch (e) {
          window[cb] = undefined;
        }
        resolve();
      };
      var s = document.createElement("script");
      s.async = true;
      s.defer = true;
      s.onerror = function () {
        try {
          delete window[cb];
        } catch (e2) {
          window[cb] = undefined;
        }
        mapsScriptPromise = null;
        reject(new Error("Failed to load Google Maps script"));
      };
      s.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        encodeURIComponent(apiKey) +
        "&callback=" +
        cb;
      document.head.appendChild(s);
    });
    return mapsScriptPromise;
  }

  function drawRouteMap(hostEl, riderLat, riderLng, destLat, destLng) {
    if (!hostEl || !window.google || !window.google.maps) return;
    var rider = { lat: riderLat, lng: riderLng };
    var dest = { lat: destLat, lng: destLng };
    var map = new google.maps.Map(hostEl, {
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });
    var bounds = new google.maps.LatLngBounds();
    bounds.extend(rider);
    bounds.extend(dest);
    map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 });
    google.maps.event.addListenerOnce(map, "idle", function () {
      if (map.getZoom() > 16) map.setZoom(16);
    });
    new google.maps.Marker({
      position: rider,
      map: map,
      title: "Rider (current location)",
      label: { text: "R", color: "#ffffff", fontWeight: "bold" },
    });
    new google.maps.Marker({
      position: dest,
      map: map,
      title: "Delivery destination",
      label: { text: "D", color: "#ffffff", fontWeight: "bold" },
    });
    new google.maps.Polyline({
      path: [rider, dest],
      geodesic: true,
      strokeColor: "#6366f1",
      strokeOpacity: 0.85,
      strokeWeight: 3,
      map: map,
    });
  }

  function mapsQueryPair(lat, lng) {
    return encodeURIComponent(String(lat) + "," + String(lng));
  }

  function hrefForHtml(url) {
    return url.split("&").join("&amp;");
  }

  /** Opens google.com/maps — works without a Maps JavaScript API key. */
  function googleMapsLinksHtml(data) {
    if (!hasValidCoords(data)) return "";
    var rl = data.rider_lat,
      rn = data.rider_lng,
      dl = data.destination_lat,
      dn = data.destination_lng;
    var dirUrl =
      "https://www.google.com/maps/dir/?api=1&origin=" +
      mapsQueryPair(rl, rn) +
      "&destination=" +
      mapsQueryPair(dl, dn) +
      "&travelmode=driving";
    var riderUrl =
      "https://www.google.com/maps/search/?api=1&query=" + mapsQueryPair(rl, rn);
    var destUrl =
      "https://www.google.com/maps/search/?api=1&query=" + mapsQueryPair(dl, dn);
    var coordLine =
      '<p class="tracking-gmaps-coords">Rider: <code>' +
      escapeHtml(String(rl) + ", " + String(rn)) +
      "</code> · Destination: <code>" +
      escapeHtml(String(dl) + ", " + String(dn)) +
      "</code></p>";
    return (
      '<div class="tracking-gmaps-links" role="group" aria-label="Open in Google Maps">' +
      '<a href="' +
      hrefForHtml(dirUrl) +
      '" class="tracking-gmaps-btn tracking-gmaps-btn--primary" target="_blank" rel="noopener noreferrer">Open route in Google Maps</a>' +
      '<a href="' +
      hrefForHtml(riderUrl) +
      '" class="tracking-gmaps-btn" target="_blank" rel="noopener noreferrer">Rider location</a>' +
      '<a href="' +
      hrefForHtml(destUrl) +
      '" class="tracking-gmaps-btn" target="_blank" rel="noopener noreferrer">Destination</a>' +
      "</div>" +
      coordLine
    );
  }

  function mapSectionHtml(data) {
    if (!hasValidCoords(data)) return "";
    var key =
      typeof window.ocpmsGetGoogleMapsApiKey === "function"
        ? window.ocpmsGetGoogleMapsApiKey()
        : "";
    var legend =
      '<div class="tracking-map-legend">' +
      '<span><span class="tracking-map-dot tracking-map-dot--rider" aria-hidden="true"></span> Rider (current)</span>' +
      '<span><span class="tracking-map-dot tracking-map-dot--dest" aria-hidden="true"></span> Delivery destination</span>' +
      "</div>";
    var linksBlock = googleMapsLinksHtml(data);
    var embedBlock;
    if (!key) {
      embedBlock =
        '<div class="tracking-map-missing-key" role="status">' +
        "<strong>Optional: map on this page.</strong> Links above open the full <strong>Google Maps</strong> app or website (no key required). To show an embedded map here, enable the <strong>Maps JavaScript API</strong> for your key, then run " +
        '<code>localStorage.setItem(&quot;ocpms_google_maps_key&quot;,&quot;YOUR_KEY&quot;)</code> in the console and reload, or set ' +
        "<code>window.OCPMS_GOOGLE_MAPS_KEY</code> before <code>config.js</code>." +
        "</div>";
    } else {
      embedBlock =
        '<div id="trackingMapHost" class="tracking-map-host" role="region" aria-label="Embedded Google Map: rider and destination"></div>' +
        '<p class="tracking-gmaps-embed-note">Same route in Google Maps: use <strong>Open route in Google Maps</strong> above for turn-by-turn navigation.</p>';
    }
    return (
      '<div class="tracking-map-section">' +
      "<h4>Google Maps</h4>" +
      legend +
      linksBlock +
      embedBlock +
      "</div>"
    );
  }

  function mountMapIfNeeded(data) {
    var key =
      typeof window.ocpmsGetGoogleMapsApiKey === "function"
        ? window.ocpmsGetGoogleMapsApiKey()
        : "";
    if (!key || !hasValidCoords(data)) return;
    var host = document.getElementById("trackingMapHost");
    if (!host) return;
    loadGoogleMapsOnce(key)
      .then(function () {
        drawRouteMap(
          host,
          data.rider_lat,
          data.rider_lng,
          data.destination_lat,
          data.destination_lng
        );
      })
      .catch(function () {
        host.innerHTML =
          '<p class="tracking-hint">Map could not be loaded. Check your API key and network.</p>';
      });
  }

  function historyRouteUrl(row) {
    return (
      "https://www.google.com/maps/dir/?api=1&origin=" +
      mapsQueryPair(row.rider_lat, row.rider_lng) +
      "&destination=" +
      mapsQueryPair(row.destination_lat, row.destination_lng) +
      "&travelmode=driving"
    );
  }

  function historyDestUrl(row) {
    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      mapsQueryPair(row.destination_lat, row.destination_lng)
    );
  }

  function statusLabel(s) {
    var t = String(s || "pending");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function rowTime(ts) {
    return ts ? new Date(ts).toLocaleString() : "—";
  }

  function renderHistory(rows) {
    if (!historyList) return;
    if (!rows || !rows.length) {
      historyList.innerHTML =
        '<p class="tracking-hint">No orders yet. Create one in <a href="admin.html">Admin</a>.</p>';
      return;
    }
    var out = "";
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var hasCoords = hasValidCoords(r);
      var mapsHtml = hasCoords
        ? '<div class="tracking-history__actions">' +
          '<a href="' +
          hrefForHtml(historyRouteUrl(r)) +
          '" class="tracking-history__btn tracking-history__btn--primary" target="_blank" rel="noopener noreferrer">Open route map</a>' +
          '<a href="' +
          hrefForHtml(historyDestUrl(r)) +
          '" class="tracking-history__btn" target="_blank" rel="noopener noreferrer">Destination map</a>' +
          "</div>"
        : '<p class="tracking-hint">Map unavailable: coordinates not set.</p>';
      var activeCls =
        localStorage.getItem(CLICKED_KEY) === String(r.reference || "")
          ? " tracking-history__item--active"
          : "";
      out +=
        '<article class="tracking-history__item' +
        activeCls +
        '" data-ref="' +
        escapeHtml(String(r.reference || "")) +
        '">' +
        '<div class="tracking-history__top">' +
        "<h4>" +
        escapeHtml(r.reference || "—") +
        "</h4>" +
        '<span class="tracking-history__pill">' +
        escapeHtml(statusLabel(r.status)) +
        "</span>" +
        "</div>" +
        '<p class="tracking-history__meta">Updated: ' +
        escapeHtml(rowTime(r.updated_at)) +
        "</p>" +
        mapsHtml +
        "</article>";
    }
    historyList.innerHTML = out;
    renderClickedMessage();
  }

  function renderClickedMessage() {
    if (!clickedMsg) return;
    var ref = localStorage.getItem(CLICKED_KEY);
    if (!ref) {
      clickedMsg.hidden = true;
      clickedMsg.textContent = "";
      return;
    }
    clickedMsg.hidden = false;
    clickedMsg.textContent = "Order clicked: " + ref;
  }

  async function loadOrderHistory() {
    if (!historyList) return;
    historyList.innerHTML = '<p class="tracking-hint">Loading order history…</p>';
    try {
      var rows = await window.ocpmsFetchJson("/api/orders?limit=50");
      renderHistory(rows || []);
    } catch (e) {
      historyList.innerHTML =
        '<p class="tracking-hint">Could not load order history. Make sure API is running.</p>';
    }
  }

  function timelineHtml(status) {
    var failed = status === "failed";
    var complete = status === "complete";
    var pending = status === "pending";
    var s1 = true;
    var s2 = complete || (pending && !failed);
    var s3 = complete;
    var s4 = complete;
    if (failed) {
      s2 = false;
      s3 = false;
      s4 = false;
    }
    function step(on, label) {
      var cls = on ? "track-step active" : "track-step";
      var icon = on ? "✓" : "○";
      return (
        '<div class="' +
        cls +
        '"><span class="step-icon">' +
        icon +
        "</span> " +
        label +
        "</div>"
      );
    }
    var warn = failed
      ? '<p class="tracking-error">This shipment is marked <strong>failed</strong>. Contact support if you need help.</p>'
      : "";
    return (
      '<div class="track-timeline">' +
      step(s1, "Booked") +
      step(s2, "In transit") +
      step(s3, "Out for delivery") +
      step(s4, "Delivered") +
      "</div>" +
      warn
    );
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = document.getElementById("trackingId").value.trim();
    if (!id) return;
    resultDiv.innerHTML =
      '<p class="tracking-hint">Looking up your parcel…</p>';
    try {
      var data = await window.ocpmsFetchJson(
        "/api/tracking/" + encodeURIComponent(id)
      );
      var st = data.status || "pending";
      var label = st.charAt(0).toUpperCase() + st.slice(1);
      var mapBlock = mapSectionHtml(data);
      resultDiv.innerHTML =
        '<div class="tracking-status">' +
        "<h3>Tracking: " +
        escapeHtml(data.reference) +
        "</h3>" +
        '<p class="tracking-status-pill">Status: <strong>' +
        escapeHtml(label) +
        "</strong></p>" +
        timelineHtml(st) +
        '<p class="tracking-meta">Last updated: ' +
        escapeHtml(
          data.updated_at
            ? new Date(data.updated_at).toLocaleString()
            : "—"
        ) +
        "</p>" +
        mapBlock +
        "</div>";
      mountMapIfNeeded(data);
      loadOrderHistory();
    } catch (err) {
      var msg = err.message || String(err);
      var offline =
        msg.indexOf("Failed to fetch") !== -1 ||
        msg.indexOf("NetworkError") !== -1;
      resultDiv.innerHTML =
        '<div class="tracking-status tracking-status--error">' +
        "<h3>Tracking: " +
        escapeHtml(id) +
        "</h3>" +
        "<p>" +
        escapeHtml(
          offline
            ? "Cannot reach the API. Start the backend (uvicorn on port 8000) or open the site from the same server."
            : msg
        ) +
        "</p>" +
        '<p class="tracking-hint">Tip: create an order in <a href="admin.html">Admin</a> with this tracking ID, then try again.</p>' +
        "</div>";
    }
  });

  historyList &&
    historyList.addEventListener("click", function (e) {
      var card = e.target.closest(".tracking-history__item");
      if (!card) return;
      var ref = card.getAttribute("data-ref");
      if (!ref) return;
      localStorage.setItem(CLICKED_KEY, ref);
      var all = historyList.querySelectorAll(".tracking-history__item");
      for (var i = 0; i < all.length; i++) {
        all[i].classList.remove("tracking-history__item--active");
      }
      card.classList.add("tracking-history__item--active");
      renderClickedMessage();
    });

  loadOrderHistory();
})();
