const jwt = require("jsonwebtoken");

module.exports = async (req, res) => {
  const cookie = req.headers.cookie || "";
  const raw = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("session="));
  const token = raw ? decodeURIComponent(raw.split("=")[1]) : "";
  let payload = null;
  try {
    if (token)
      payload = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: false,
      });
  } catch (_) {}

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      authenticated: !!payload,
      provider: payload?.provider || null,
      mode: payload?.mode || null,
    })
  );
};
