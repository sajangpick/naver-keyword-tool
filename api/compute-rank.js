// Rank computation serverless function for Vercel
// Accepts: { rows, mapping: {name,url,visit,blog,save,date}, weights:[w1,w2,w3] | "w1,w2,w3", topk, target }

function numberize(value) {
  if (typeof value === "number") return value;
  if (value == null) return 0;
  const s = String(value).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function minmax(values) {
  if (!values || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v) => (v - min) / span);
}

function computeRank(rows, mapping, weights, topk, target) {
  const nameKey = mapping?.name || "";
  const urlKey = mapping?.url || "";
  const visitKey = mapping?.visit || "";
  const blogKey = mapping?.blog || "";
  const saveKey = mapping?.save || "";
  const dateKey = mapping?.date || "";
  if (!nameKey || !visitKey || !blogKey || !saveKey) {
    return [{ error: "매핑이 부족합니다(name, visit, blog, save 필수)." }, 400];
  }

  let [w1, w2, w3] = Array.isArray(weights)
    ? weights
    : String(weights || "0.4,0.35,0.25")
        .split(",")
        .map((x) => parseFloat(x));
  if (![w1, w2, w3].every((x) => Number.isFinite(x))) {
    w1 = 0.4;
    w2 = 0.35;
    w3 = 0.25;
  }
  const wsum = w1 + w2 + w3 || 1;
  const W = [w1 / wsum, w2 / wsum, w3 / wsum];

  const byDate = {};
  for (const r of rows || []) {
    const name = r?.[nameKey];
    const url = r?.[urlKey];
    const v = numberize(r?.[visitKey]);
    const b = numberize(r?.[blogKey]);
    const s = numberize(r?.[saveKey]);
    const dateVal = dateKey && r?.[dateKey] ? String(r[dateKey]) : "single";
    byDate[dateVal] = byDate[dateVal] || [];
    byDate[dateVal].push({ name, url, visit: v, blog: b, save: s });
  }

  const dates = Object.keys(byDate).sort();
  const latest = dates.length ? byDate[dates[dates.length - 1]] : [];
  const nv = minmax(latest.map((r) => r.visit));
  const nb = minmax(latest.map((r) => r.blog));
  const ns = minmax(latest.map((r) => r.save));
  const enriched = latest.map((r, i) => ({
    name: r.name,
    url: r.url,
    visit: r.visit,
    blog: r.blog,
    save: r.save,
    N1: nv[i],
    N2: nb[i],
    N3: ns[i],
    score: W[0] * nv[i] + W[1] * nb[i] + W[2] * ns[i],
  }));
  enriched.sort((a, b) => b.score - a.score);

  const limit = Math.max(5, parseInt(topk || 15, 10));
  const top = enriched
    .slice(0, limit)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));

  const daily = [];
  const tname = (target || "").trim();
  if (tname && dates.length > 1) {
    for (const d of dates) {
      const slice = byDate[d] || [];
      const _nv = minmax(slice.map((r) => r.visit));
      const _nb = minmax(slice.map((r) => r.blog));
      const _ns = minmax(slice.map((r) => r.save));
      const scored = slice.map((r, i) => ({
        name: r.name,
        N1: _nv[i],
        N2: _nb[i],
        N3: _ns[i],
        score: W[0] * _nv[i] + W[1] * _nb[i] + W[2] * _ns[i],
      }));
      scored.sort((a, b) => b.score - a.score);
      const idx = scored.findIndex((x) => String(x.name) === String(tname));
      if (idx !== -1) {
        const me = scored[idx];
        daily.push({
          date: d,
          rank: idx + 1,
          N1: me.N1,
          N2: me.N2,
          N3: me.N3,
          score: me.score,
        });
      }
    }
  }

  return [{ top, daily }, 200];
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  try {
    let body = req.body;
    if (!body || typeof body === "string") {
      try {
        body = JSON.parse(body || "{}");
      } catch (_) {
        body = {};
      }
    }
    const {
      rows = [],
      mapping = {},
      weights = [0.4, 0.35, 0.25],
      topk = 15,
      target = "",
    } = body;
    const [payload, status] = computeRank(rows, mapping, weights, topk, target);
    res.status(status).json(payload);
  } catch (e) {
    res
      .status(500)
      .json({ error: "서버 오류", detail: String((e && e.message) || e) });
  }
};
