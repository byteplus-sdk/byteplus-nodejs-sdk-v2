describe("Debug Env", () => {
  it("should log BYTEPLUS_PROXY_PORT", () => {
    console.log("BYTEPLUS_PROXY_PORT:", process.env.BYTEPLUS_PROXY_PORT);
    console.log("BYTEPLUS_PROXY_HOST:", process.env.BYTEPLUS_PROXY_HOST);
  });
});
