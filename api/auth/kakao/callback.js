const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const https = require("https");

function readJson(res) {
  return new Promise((resolve, reject) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    res.on("error", reject);
  });
}

function fetchToken(params) {
  const query = new URLSearchParams(params).toString();
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(query),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://kauth.kakao.com/oauth/token",
      options,
      async (res) => {
        try {
          resolve(await readJson(res));
        } catch (e) {
          reject(e);
        }
      }
    );
    req.on("error", reject);
    req.write(query);
    req.end();
  });
}

function buildCookie(name, value, { maxAge, secure = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

module.exports = async (req, res) => {
  try {
    const { code, state } = req.query || {};
    const kstate = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("kstate="));
    const cookieState = kstate ? decodeURIComponent(kstate.split("=")[1]) : "";
    if (!code || !state || state !== cookieState) {
      res.statusCode = 400;
      res.end("Invalid state");
      return;
    }

    const [, mode] = state.split(":");

    const tokenPayload = {
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code,
    };
    if (process.env.KAKAO_CLIENT_SECRET)
      tokenPayload.client_secret = process.env.KAKAO_CLIENT_SECRET;

    const token = await fetchToken(tokenPayload);
    if (!token || !token.access_token) {
      res.statusCode = 502;
      res.end("Failed to get token");
      return;
    }

    const jwtSecret =
      process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
    const session = jwt.sign(
      { provider: "kakao", mode, iat: Math.floor(Date.now() / 1000) },
      jwtSecret,
      { expiresIn: "2h" }
    );

    // Set session cookie and clear csrf cookie
    res.setHeader("Set-Cookie", [
      buildCookie("session", session, { maxAge: 7200 }),
      "kstate=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    ]);

    const target =
      mode === "signup" ? "/join.html?signup=ok" : "/login.html?login=ok";
    res.statusCode = 302;
    res.setHeader("Location", target);
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.end("Callback error");
  }
};
