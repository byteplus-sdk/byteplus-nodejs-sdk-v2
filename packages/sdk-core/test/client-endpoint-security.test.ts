import { Client } from "../src/client/Client";
import { Command } from "../src/command/Command";
import { buildRequestConfigFromMetaPath } from "../src/utils/meta";
import { EndpointValidationError } from "../src/utils/endpoint-validation";
import type { ClientConfig } from "../src/types/types";
import * as signer from "../src/utils/signer";
import * as envUtils from "../src/utils/env";
import { __test_defaultEndpoint } from "../src/utils/endpoint";
import * as fs from "fs";
import * as path from "path";
import {
  Field,
  codeOf,
  invalidCases,
  messageOf,
  testCredentials,
  validLabels,
} from "./endpoint-security-cases";

// 与代码生成器产出的服务客户端结构一致（见 service/*/src/api.ts）。
class GeneratedVPCClient extends Client {
  constructor(config: ClientConfig = {}) {
    super({ protocol: "https", region: "ap-southeast-1", ...config });
  }
}

class GeneratedDescribeVpcsCommand extends Command<any, any, any> {
  static readonly metaPath = "/DescribeVpcs/2020-04-01/vpc/get/text_plain/";
  constructor(input: any) {
    super(input);
    this.requestConfig = buildRequestConfigFromMetaPath(GeneratedDescribeVpcsCommand.metaPath);
  }
}

function genericCommand(serviceName: string) {
  const cmd = new Command({ Action: "ListTestResources", Version: "2020-01-01" });
  cmd.requestConfig = { method: "GET", serviceName, pathname: "/" };
  return cmd;
}

function harness(overrides: Partial<ClientConfig> = {}, generated = false) {
  const resolveCredentials = jest.fn().mockResolvedValue({ ...testCredentials });
  const request = jest
    .fn()
    .mockResolvedValue({ status: 200, statusText: "OK", headers: {}, data: { ok: true } });
  const config: ClientConfig = {
    region: "ap-southeast-1",
    credentialProvider: { providerName: "endpoint-security-test", resolveCredentials },
    requestHandler: { request },
    ...overrides,
  };
  const client = generated ? new GeneratedVPCClient(config) : new Client(config);
  return { client, resolveCredentials, request };
}

function header(headers: Record<string, any>, name: string): unknown {
  const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

const failIfCalled = (name: string) =>
  jest.fn(() => {
    throw new Error(`${name} must not be called`);
  });

describe("Client endpoint security", () => {
  let sign: jest.SpyInstance;
  let presign: jest.SpyInstance;

  beforeEach(() => {
    jest
      .spyOn(envUtils, "loadEnv")
      .mockReturnValue({ credentials: {}, enableDualstack: false });
    sign = jest.spyOn(signer, "signRequest");
    presign = jest.spyOn(signer, "presignUrl");
  });
  afterEach(() => jest.restoreAllMocks());

  async function expectRejected(promise: Promise<unknown>, field: Field, quoted: string, reason: string) {
    let err: unknown;
    try {
      await promise;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EndpointValidationError);
    expect((err as EndpointValidationError).code).toBe(codeOf(field));
    expect((err as EndpointValidationError).message).toBe(messageOf(field, quoted, reason));
  }

  describe.each(["send", "presign"] as const)("%s", (operation) => {
    describe("generic client", () => {
      test.each(invalidCases)("rejects region %j before credentials, signing and transport", async (region, quoted, reason) => {
        let h!: ReturnType<typeof harness>;
        expect(() => {
          h = harness({ region });
        }).not.toThrow();
        await expectRejected(h.client[operation](genericCommand("ecs")), "region", quoted, reason);
        expect(h.resolveCredentials).not.toHaveBeenCalled();
        expect(sign).not.toHaveBeenCalled();
        expect(presign).not.toHaveBeenCalled();
        expect(h.request).toHaveBeenCalledTimes(0);
      });

      test.each(invalidCases)("rejects service %j before credentials, signing and transport", async (service, quoted, reason) => {
        const h = harness();
        await expectRejected(h.client[operation](genericCommand(service)), "service", quoted, reason);
        expect(h.resolveCredentials).not.toHaveBeenCalled();
        expect(sign).not.toHaveBeenCalled();
        expect(presign).not.toHaveBeenCalled();
        expect(h.request).toHaveBeenCalledTimes(0);
      });
    });

    describe("generated service client", () => {
      test.each(invalidCases)("rejects region %j before credentials, signing and transport", async (region, quoted, reason) => {
        const h = harness({ region }, true);
        await expectRejected(h.client[operation](new GeneratedDescribeVpcsCommand({})), "region", quoted, reason);
        expect(h.resolveCredentials).not.toHaveBeenCalled();
        expect(sign).not.toHaveBeenCalled();
        expect(presign).not.toHaveBeenCalled();
        expect(h.request).toHaveBeenCalledTimes(0);
      });
    });

    describe.each(["client", "command"] as const)("custom resolver on %s stack", (owner) => {
      test.each(["service", "region"] as const)("is never invoked for invalid %s", async (field) => {
        const h = harness({ region: field === "region" ? "cn-beijing@127.0.0.1" : "cn-beijing" });
        const cmd = genericCommand(field === "service" ? "evil.com" : "ecs");
        const resolver = failIfCalled("custom resolver");
        const early = failIfCalled("highest priority middleware");
        const stack = owner === "client" ? h.client.middlewareStack : cmd.middlewareStack;
        stack.add(() => resolver as any, { name: "endpointMiddleware", step: "initialize", priority: 50, override: true });
        stack.add(() => early as any, { name: "earlyMiddleware", step: "initialize", priority: Number.MAX_SAFE_INTEGER });
        await expect(h.client[operation](cmd)).rejects.toMatchObject({ code: codeOf(field) });
        expect(resolver).not.toHaveBeenCalled();
        expect(early).not.toHaveBeenCalled();
        expect(h.request).toHaveBeenCalledTimes(0);
      });
    });

    test("unknown services are validated too", async () => {
      const h = harness({ region: "cn#beijing" });
      await expectRejected(
        h.client[operation](genericCommand("unknown_service")),
        "region",
        '"cn#beijing"',
        "illegal character at index 2",
      );
      expect(h.request).toHaveBeenCalledTimes(0);
    });

    test("an explicit host is kept and region/service are not validated", async () => {
      const h = harness({ host: "custom.example.com:8443", region: "cn/beijing" });
      const result = await h.client[operation](genericCommand("e@cs"));
      if (operation === "send") {
        expect(result).toEqual({ ok: true });
        expect(h.request).toHaveBeenCalledTimes(1);
        expect(h.request.mock.calls[0][0].url).toMatch(/^https:\/\/custom\.example\.com:8443\//);
      } else {
        expect(result).toMatch(/^https:\/\/custom\.example\.com:8443\//);
      }
    });
  });

  test("presign produces no URL for invalid input and a signed URL for legal input", async () => {
    const h = harness({ region: "cn-beijing:443" });
    let url: string | undefined;
    await expect(
      h.client.presign(genericCommand("ecs")).then((u) => {
        url = u;
      }),
    ).rejects.toMatchObject({ code: "InvalidRegion" });
    expect(url).toBeUndefined();
    expect(presign).not.toHaveBeenCalled();

    h.client.config.region = "ap-southeast-1";
    url = await h.client.presign(genericCommand("ecs"));
    expect(url).toMatch(/^https:\/\/ecs\.ap-southeast-1\.byteplusapi\.com\/\?/);
    expect(url).toContain("X-Signature=");
    expect(presign).toHaveBeenCalledTimes(1);
  });

  describe("deferred failure after construction", () => {
    test.each([false, true])("generated=%s: invalid region set later fails, restoring it recovers", async (generated) => {
      const h = harness({}, generated);
      const cmd = () => (generated ? new GeneratedDescribeVpcsCommand({}) : genericCommand("ecs"));

      await expect(h.client.send(cmd())).resolves.toEqual({ ok: true });
      expect(h.request).toHaveBeenCalledTimes(1);

      h.client.config.region = "cn-beijing@127.0.0.1";
      await expect(h.client.send(cmd())).rejects.toMatchObject({ code: "InvalidRegion" });
      expect(h.request).toHaveBeenCalledTimes(1);

      h.client.config.region = "ap-southeast-1";
      await expect(h.client.send(cmd())).resolves.toEqual({ ok: true });
      expect(h.request).toHaveBeenCalledTimes(2);
      expect(h.request.mock.calls[1][0].url).toMatch(/^https:\/\/(ecs|vpc)\.ap-southeast-1\.byteplusapi\.com\//);
    });

    test("validation still reads the current config after setCredentials", async () => {
      const h = harness();
      h.client.setCredentials({ providerName: "p", resolveCredentials: async () => ({ ...testCredentials }) });
      h.client.config.region = "evil.com";
      await expect(h.client.send(genericCommand("ecs"))).rejects.toMatchObject({ code: "InvalidRegion" });
      h.client.config.region = "ap-southeast-1";
      await expect(h.client.send(genericCommand("ecs"))).resolves.toEqual({ ok: true });
      expect(h.request).toHaveBeenCalledTimes(1);
    });
  });

  describe("signing is not performed for invalid input", () => {
    function invoke(client: Client, region: string, serviceName = "ecs") {
      const handler = client.middlewareStack.resolve(async (args: any) => args, {
        clientName: "Client",
        commandName: "Command",
        clientConfig: client.config,
        contentType: "",
      });
      const request: any = {
        method: "GET",
        pathname: "/",
        protocol: "https",
        params: { Action: "ListTestResources", Version: "2020-01-01" },
        headers: {},
        serviceName,
        region,
      };
      return { promise: handler({ request }), request };
    }

    test.each(["cn-beijing@127.0.0.1", "cn\nbeijing", "1cn-beijing"])("request object stays unsigned for region %j", async (region) => {
      const h = harness();
      const { promise, request } = invoke(h.client, region);
      await expect(promise).rejects.toMatchObject({ code: "InvalidRegion" });
      expect(header(request.headers, "Authorization")).toBeUndefined();
      expect(header(request.headers, "X-Date")).toBeUndefined();
      expect(request.host).toBeUndefined();
      expect(sign).not.toHaveBeenCalled();
      expect(h.request).toHaveBeenCalledTimes(0);
    });

    test("request object stays unsigned for an invalid service", async () => {
      const h = harness();
      const { promise, request } = invoke(h.client, "cn-beijing", "ecs/../");
      await expect(promise).rejects.toMatchObject({ code: "InvalidService" });
      expect(header(request.headers, "Authorization")).toBeUndefined();
      expect(header(request.headers, "X-Date")).toBeUndefined();
      expect(h.request).toHaveBeenCalledTimes(0);
    });

    test("control: legal input is signed in place", async () => {
      const h = harness();
      const { promise, request } = invoke(h.client, "cn-beijing");
      await promise;
      expect(header(request.headers, "Authorization")).toMatch(/^HMAC-SHA256 Credential=TEST_ACCESS_KEY\/\d{8}\/cn-beijing\/ecs\/request/);
      expect(header(request.headers, "X-Date")).toMatch(/^\d{8}T\d{6}Z$/);
      expect(h.request).toHaveBeenCalledTimes(1);
    });
  });

  test.each(validLabels.filter((v) => v !== ""))("legal label %j is accepted end to end", async (label) => {
    const h = harness({ region: label });
    await expect(h.client.send(genericCommand(label))).resolves.toEqual({ ok: true });
    expect(sign).toHaveBeenCalledTimes(1);
  });

  test("every generated service still reaches the originally configured host", async () => {
    const serviceRoot = path.resolve(__dirname, "../../../service");
    const services = new Set<string>();
    for (const dir of fs.readdirSync(serviceRoot)) {
      const api = path.join(serviceRoot, dir, "src", "api.ts");
      if (!fs.existsSync(api)) continue;
      for (const m of fs.readFileSync(api, "utf8").matchAll(/metaPath = '(\/[^']+\/)'/g)) {
        services.add(m[1]);
      }
    }
    const seen = new Set<string>();
    const h = harness({}, true);
    for (const metaPath of services) {
      const serviceName = metaPath.split("/")[3];
      if (seen.has(serviceName)) continue;
      seen.add(serviceName);
      const cmd = new Command({});
      cmd.requestConfig = buildRequestConfigFromMetaPath(metaPath);
      await h.client.send(cmd);
    }
    expect(seen.size).toBeGreaterThan(30);
    expect(h.request).toHaveBeenCalledTimes(seen.size);
    const names = [...seen];
    h.request.mock.calls.forEach((call, i) => {
      const service = names[i];
      const info = __test_defaultEndpoint[service];
      const svc = service.toLowerCase().replace(/_/g, "-");
      const host = !info
        ? "open.ap-southeast-1.byteplusapi.com"
        : info.IsGlobal
          ? `${svc}.byteplusapi.com`
          : `${svc}.ap-southeast-1.byteplusapi.com`;
      expect(call[0].url.startsWith(`https://${host}/`)).toBe(true);
    });
  });
});
