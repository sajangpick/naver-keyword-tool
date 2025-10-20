module.exports = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.COOKIE_DOMAIN || (isProd ? ".sajangpick.co.kr" : undefined);
  const base = `Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;
  const domain = cookieDomain ? `; Domain=${cookieDomain}` : "";
  res.setHeader("Set-Cookie", [
    `session=; ${base}${domain}`,
    `kstate=; ${base}${domain}`,
  ]);
  res.statusCode = 200;
  res.end("ok");
};
