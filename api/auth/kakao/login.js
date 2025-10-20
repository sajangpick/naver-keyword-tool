const crypto = require("crypto");

function buildCookie(
  name,
  value,
  { maxAge, secure, domain } = {}
) {
  const pieces = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (typeof maxAge === "number") pieces.push(`Max-Age=${maxAge}`);
  if (domain) pieces.push(`Domain=${domain}`);
  if (secure) pieces.push("Secure");
  return pieces.join("; ");
}

module.exports = async (req, res) => {
  const clientId = process.env.KAKAO_REST_API_KEY;
  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    res.statusCode = 500;
    res.end("Missing KAKAO_REST_API_KEY or KAKAO_REDIRECT_URI");
    return;
  }

  // Preserve caller intent (login/signup) while protecting with CSRF state
  const mode = req.query.state === "signup" ? "signup" : "login";
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = `${nonce}:${mode}`;

  // Set short-lived CSRF cookie
  const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.COOKIE_DOMAIN || (isProd ? ".sajangpick.co.kr" : undefined);
  res.setHeader(
    "Set-Cookie",
    buildCookie("kstate", state, {
      maxAge: 300,
      secure: isProd,
      domain: cookieDomain,
    })
  );

  const authorize = new URL("https://kauth.kakao.com/oauth/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);

  res.statusCode = 302;
  res.setHeader("Location", authorize.toString());
  res.end();
};
