import express from "express";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "node", runtime: process.version });
});

/** Proxies to Python to show cross-service + shared DB-backed data */
app.get("/api/items/via-python", async (_req, res) => {
  try {
    const r = await fetch(`${PYTHON_URL}/api/items`);
    if (!r.ok) {
      return res.status(r.status).json({ error: "python_upstream_failed" });
    }
    const data = await r.json();
    res.json({
      source: "node",
      fetchedFrom: PYTHON_URL,
      items: data,
    });
  } catch (e) {
    res.status(502).json({
      error: "cannot_reach_python",
      detail: String(e?.message || e),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Node service http://127.0.0.1:${PORT}`);
});
