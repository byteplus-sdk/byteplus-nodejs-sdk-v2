import { Client } from "../src/client/Client";
import { buildAuthToken } from "../src/feature/rds/connect";
import { EndpointValidationError } from "../src/utils/endpoint-validation";
import * as signer from "../src/utils/signer";
import * as envUtils from "../src/utils/env";
import { invalidCases, messageOf, testCredentials } from "./endpoint-security-cases";

const options = { dbUser: "test-user", instanceId: "test-instance" };

function harness(region: string) {
  const resolveCredentials = jest.fn().mockResolvedValue({ ...testCredentials });
  const request = jest
    .fn()
    .mockResolvedValue({ status: 200, statusText: "OK", headers: {}, data: { ok: true } });
  const config = {
    ...testCredentials,
    host: "db.internal:3306",
    protocol: "http" as const,
    region,
    credentialProvider: { providerName: "endpoint-security-test", resolveCredentials },
    requestHandler: { request },
  };
  return { client: new Client(config), config, request, resolveCredentials };
}

describe("RDS buildAuthToken endpoint security", () => {
  beforeEach(() => {
    jest.spyOn(envUtils, "loadEnv").mockReturnValue({ credentials: {}, enableDualstack: false });
  });
  afterEach(() => jest.restoreAllMocks());

  test.each(invalidCases)("rejects region %j before touching config or signing", async (region, quoted, reason) => {
    const h = harness(region);
    const snapshot = { ...h.config };
    const clientPresign = jest.spyOn(h.client, "presign");
    const presign = jest.spyOn(signer, "presignUrl");
    let token: string | undefined;
    let err: unknown;
    try {
      token = await buildAuthToken(h.client, options);
    } catch (e) {
      err = e;
    }
    expect(token).toBeUndefined();
    expect(err).toBeInstanceOf(EndpointValidationError);
    expect((err as EndpointValidationError).code).toBe("InvalidRegion");
    expect((err as EndpointValidationError).message).toBe(messageOf("region", quoted, reason));
    expect(h.client.config).toEqual(snapshot);
    expect(clientPresign).not.toHaveBeenCalled();
    expect(presign).not.toHaveBeenCalled();
    expect(h.resolveCredentials).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
  });

  test("works again on the same client after the region is corrected", async () => {
    const h = harness("ap\nsoutheast-1");
    await expect(buildAuthToken(h.client, options)).rejects.toMatchObject({ code: "InvalidRegion" });
    expect(h.client.config.host).toBe("db.internal:3306");
    expect(h.client.config.protocol).toBe("http");

    h.client.config.region = "ap-southeast-1";
    const token = await buildAuthToken(h.client, options);
    expect(token).toContain("https://rds-mysql.ap-southeast-1.byteplusapi.comAction=");
    expect(token).toContain("X-HOST=db.internal%3A3306");
    expect(token).toContain("%2Fap-southeast-1%2Frds_mysql%2Frequest");
    expect(h.request).not.toHaveBeenCalled();
  });

  test.each([
    ["ap-southeast-3", false, "rds-mysql.ap-southeast-3.byteplusapi.com"],
    ["ap-southeast-3", true, "rds-mysql.ap-southeast-3.byteplus-api.com"],
    ["cn-beijing", false, "rds-mysql.cn-beijing.byteplusapi.com.cn"],
  ] as const)("legal region %j keeps the original host (dualstack=%s)", async (region, useDualStack, host) => {
    const h = harness(region);
    h.client.config.useDualStack = useDualStack;
    const token = await buildAuthToken(h.client, options);
    expect(token).toContain(`https://${host}Action=`);
  });
});
