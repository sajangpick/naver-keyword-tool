module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", [
    "session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    "kstate=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
  ]);
  res.statusCode = 200;
  res.end("ok");
};
