(function () {
  const AUTH_KEY = "ocpms_admin_auth";
  const API_KEY = "ocpms_api_base";
  const DEMO_PASSWORD = "ocpms-admin";

  const gate = document.getElementById("admin-gate");
  const dashboard = document.getElementById("admin-dashboard");
  const gateForm = document.getElementById("admin-gate-form");
  const gateError = document.getElementById("admin-gate-error");
  const apiBaseInput = document.getElementById("api-base");
  const refreshBtn = document.getElementById("admin-refresh");
  const signOutBtn = document.getElementById("admin-sign-out");
  const banner = document.getElementById("admin-api-banner");
  const statCount = document.getElementById("stat-count");
  const statNode = document.getElementById("stat-node");
  const statUp = document.getElementById("stat-up");
  const serviceList = document.getElementById("admin-service-list");
  const tableBody = document.getElementById("admin-table-body");
  const addForm = document.getElementById("admin-add-form");
  const addTitle = document.getElementById("admin-add-title");
  const addMessage = document.getElementById("admin-add-message");
  const orderCountPending = document.getElementById("order-count-pending");
  const orderCountFailed = document.getElementById("order-count-failed");
  const orderCountComplete = document.getElementById("order-count-complete");
  const orderCountTotal = document.getElementById("order-count-total");
  const orderFeedback = document.getElementById("admin-order-feedback");
  const ordersBody = document.getElementById("admin-orders-body");
  const orderAddForm = document.getElementById("admin-order-add-form");
  const orderReference = document.getElementById("admin-order-reference");
  const orderStatusNew = document.getElementById("admin-order-status-new");
  const orderAddMessage = document.getElementById("admin-order-add-message");

  function apiBase() {
    const typed = apiBaseInput?.value?.trim();
    if (typed) return typed.replace(/\/$/, "");
    if (typeof window.ocpmsGetApiBase === "function") {
      const b = window.ocpmsGetApiBase();
      return (b ?? "").replace(/\/$/, "");
    }
    return (localStorage.getItem(API_KEY) || "http://127.0.0.1:8000").replace(
      /\/$/,
      ""
    );
  }

  function setBanner(text, isError) {
    if (!banner) return;
    if (!text) {
      banner.hidden = true;
      banner.textContent = "";
      return;
    }
    banner.hidden = false;
    banner.textContent = text;
    banner.classList.toggle("admin-api-banner--error", !!isError);
  }

  function isAuthed() {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  }

  function showGate() {
    gate.hidden = false;
    dashboard.hidden = true;
  }

  function showDashboard() {
    gate.hidden = true;
    dashboard.hidden = false;
    if (apiBaseInput && !apiBaseInput.value) {
      const saved = localStorage.getItem(API_KEY);
      if (saved) apiBaseInput.value = saved;
      else if (String(window.location.port) === "8000")
        apiBaseInput.value = "";
      else
        apiBaseInput.value = "http://127.0.0.1:8000";
    }
    refreshAll();
  }

  function parseErrorBody(t) {
    try {
      const j = JSON.parse(t);
      const d = j.detail;
      if (Array.isArray(d))
        return d.map((x) => x.msg || JSON.stringify(x)).join("; ");
      return String(d ?? j.message ?? t);
    } catch {
      return t || "Request failed";
    }
  }

  async function fetchJson(path, options) {
    const base = apiBase();
    const p = path.startsWith("/") ? path : `/${path}`;
    const url = base ? `${base.replace(/\/$/, "")}${p}` : p;
    const r = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(parseErrorBody(t));
    }
    if (r.status === 204) return null;
    return r.json();
  }

  function renderServices(stack) {
    serviceList.innerHTML = "";
    const rows = [
      { key: "python", label: "Python API", data: stack.python },
      { key: "node", label: "Node service", data: stack.node },
      { key: "go", label: "Go service", data: stack.go },
    ];
    let up = 0;
    for (const { label, data } of rows) {
      const ok =
        label === "Python API"
          ? data && data.ok !== false
          : data && data.ok === true;
      if (ok) up += 1;
      const li = document.createElement("li");
      li.className = "admin-service-row";
      li.innerHTML = `
        <span class="admin-service-name">${label}</span>
        <span class="admin-pill ${ok ? "admin-pill--ok" : "admin-pill--bad"}">${ok ? "Online" : "Unreachable"}</span>
      `;
      serviceList.appendChild(li);
    }
    statUp.textContent = String(up);
  }

  function renderTable(items) {
    tableBody.innerHTML = "";
    if (!items || !items.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="3" class="admin-table-empty">No records yet. Add one above.</td>';
      tableBody.appendChild(tr);
      return;
    }
    for (const row of items) {
      const tr = document.createElement("tr");
      const created = row.created_at
        ? new Date(row.created_at).toLocaleString()
        : "—";
      tr.innerHTML = `<td>${row.id}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(created)}</td>`;
      tableBody.appendChild(tr);
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function setOrderFeedback(text, isError) {
    if (!orderFeedback) return;
    if (!text) {
      orderFeedback.hidden = true;
      orderFeedback.textContent = "";
      return;
    }
    orderFeedback.hidden = false;
    orderFeedback.textContent = text;
    orderFeedback.style.color = isError ? "#fca5a5" : "var(--color-text-muted)";
  }

  function clearOrderSheet() {
    if (orderCountPending) orderCountPending.textContent = "—";
    if (orderCountFailed) orderCountFailed.textContent = "—";
    if (orderCountComplete) orderCountComplete.textContent = "—";
    if (orderCountTotal) orderCountTotal.textContent = "—";
    setOrderFeedback("");
  }

  function renderOrderSheet(summary) {
    if (!summary) {
      clearOrderSheet();
      return;
    }
    if (orderCountPending) orderCountPending.textContent = String(summary.pending ?? 0);
    if (orderCountFailed) orderCountFailed.textContent = String(summary.failed ?? 0);
    if (orderCountComplete) orderCountComplete.textContent = String(summary.complete ?? 0);
    if (orderCountTotal) orderCountTotal.textContent = String(summary.total ?? 0);
  }

  function statusSelectHtml(orderId, current) {
    const opts = ["pending", "failed", "complete"]
      .map(
        (s) =>
          `<option value="${s}"${s === current ? " selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
      )
      .join("");
    return `<select class="admin-order-status-select" data-order-id="${orderId}" data-prev="${escapeHtml(current)}">${opts}</select>`;
  }

  function renderOrdersTable(orders) {
    if (!ordersBody) return;
    ordersBody.innerHTML = "";
    if (!orders || !orders.length) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td colspan="5" class="admin-table-empty">No orders yet. Add an order in the panel above.</td>';
      ordersBody.appendChild(tr);
      return;
    }
    for (const row of orders) {
      const tr = document.createElement("tr");
      const created = row.created_at
        ? new Date(row.created_at).toLocaleString()
        : "—";
      const updated = row.updated_at
        ? new Date(row.updated_at).toLocaleString()
        : "—";
      const st = row.status || "pending";
      tr.innerHTML = `
        <td>${row.id}</td>
        <td>${escapeHtml(row.reference)}</td>
        <td>${statusSelectHtml(row.id, st)}</td>
        <td>${escapeHtml(created)}</td>
        <td>${escapeHtml(updated)}</td>`;
      ordersBody.appendChild(tr);
    }
  }

  async function loadOrdersData() {
    const summary = await fetchJson("/api/orders/summary");
    renderOrderSheet(summary);
    const orders = await fetchJson("/api/orders?limit=200");
    renderOrdersTable(orders);
    setOrderFeedback("");
  }

  async function refreshAll() {
    setBanner("");
    const base = apiBase();
    if (base) localStorage.setItem(API_KEY, base);
    else localStorage.removeItem(API_KEY);

    try {
      const countData = await fetchJson("/api/items/count");
      statCount.textContent = String(countData.count ?? "0");
    } catch (e) {
      statCount.textContent = "—";
      setBanner(
        `Cannot reach API at ${base}. Start the Python backend (uvicorn) or check the URL. ${e.message}`,
        true
      );
      tableBody.innerHTML =
        '<tr><td colspan="3" class="admin-table-empty">API unavailable.</td></tr>';
      statNode.textContent = "—";
      statUp.textContent = "—";
      serviceList.innerHTML = "";
      clearOrderSheet();
      if (ordersBody) {
        ordersBody.innerHTML =
          '<tr><td colspan="5" class="admin-table-empty">API unavailable.</td></tr>';
      }
      return;
    }

    try {
      await loadOrdersData();
    } catch (e) {
      clearOrderSheet();
      if (ordersBody) {
        ordersBody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">${escapeHtml(e.message)}</td></tr>`;
      }
      setOrderFeedback("Could not load orders. Ensure the backend includes /api/orders routes.", true);
    }

    try {
      const items = await fetchJson("/api/items?limit=100");
      renderTable(items);
    } catch (e) {
      tableBody.innerHTML = `<tr><td colspan="3" class="admin-table-empty">${escapeHtml(e.message)}</td></tr>`;
    }

    try {
      const stack = await fetchJson("/api/stack/status");
      renderServices(stack);
    } catch {
      statUp.textContent = "—";
      serviceList.innerHTML =
        '<li class="admin-service-row"><span class="admin-service-name">Stack check</span><span class="admin-pill admin-pill--bad">Failed</span></li>';
    }

    const originForNode = base || window.location.origin || "";
    const nodeUrl = originForNode.replace(/:\d+$/, ":3001");
    try {
      const nr = await fetch(`${nodeUrl}/api/items/via-python`);
      if (nr.ok) {
        const j = await nr.json();
        const n = Array.isArray(j.items) ? j.items.length : "—";
        statNode.textContent = String(n);
      } else {
        statNode.textContent = "—";
      }
    } catch {
      statNode.textContent = "—";
    }
  }

  gateForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    gateError.hidden = true;
    const pwd = document.getElementById("admin-password").value;
    if (pwd === DEMO_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      showDashboard();
    } else {
      gateError.textContent = "Incorrect access phrase.";
      gateError.hidden = false;
    }
  });

  signOutBtn?.addEventListener("click", () => {
    sessionStorage.removeItem(AUTH_KEY);
    showGate();
  });

  refreshBtn?.addEventListener("click", () => refreshAll());

  apiBaseInput?.addEventListener("change", () => refreshAll());

  ordersBody?.addEventListener("change", async (e) => {
    const t = e.target;
    if (!t.classList?.contains("admin-order-status-select")) return;
    const id = t.dataset.orderId;
    const prev = t.dataset.prev || "pending";
    const status = t.value;
    if (!id || status === prev) return;
    try {
      await fetchJson(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      t.dataset.prev = status;
      setOrderFeedback("");
      await loadOrdersData();
    } catch (err) {
      t.value = prev;
      setOrderFeedback(err.message || "Could not update status.", true);
    }
  });

  orderAddForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (orderAddMessage) orderAddMessage.hidden = true;
    const ref = orderReference?.value.trim();
    const status = orderStatusNew?.value || "pending";
    if (!ref) return;
    try {
      await fetchJson("/api/orders", {
        method: "POST",
        body: JSON.stringify({ reference: ref, status }),
      });
      orderReference.value = "";
      if (orderStatusNew) orderStatusNew.value = "pending";
      if (orderAddMessage) {
        orderAddMessage.textContent = "Order added.";
        orderAddMessage.classList.remove("admin-form-message--error");
        orderAddMessage.hidden = false;
      }
      await loadOrdersData();
    } catch (err) {
      if (orderAddMessage) {
        orderAddMessage.textContent = err.message || "Could not add order.";
        orderAddMessage.classList.add("admin-form-message--error");
        orderAddMessage.hidden = false;
      }
    }
  });

  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    addMessage.hidden = true;
    const title = addTitle.value.trim();
    if (!title) return;
    try {
      await fetchJson("/api/items", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      addTitle.value = "";
      addMessage.textContent = "Record added.";
      addMessage.classList.remove("admin-form-message--error");
      addMessage.hidden = false;
      await refreshAll();
    } catch (err) {
      addMessage.textContent = err.message || "Could not add record.";
      addMessage.classList.add("admin-form-message--error");
      addMessage.hidden = false;
    }
  });

  if (isAuthed()) {
    showDashboard();
  } else {
    showGate();
  }
})();
