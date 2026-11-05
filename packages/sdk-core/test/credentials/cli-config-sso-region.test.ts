import * as crypto from "crypto";
import * as fs from "fs";
import http from "http";
import https from "https";
import * as os from "os";
import * as path from "path";
import { CLIConfigCredentialProvider } from "../../src/credentials/CLIConfigCredentialProvider";
import { EndpointValidationError } from "../../src/utils/endpoint-validation";
import * as envUtils from "../../src/utils/env";
import { invalidCases, messageOf } from "../endpoint-security-cases";

const SESSION = "corp";
const START_URL = "https://example.invalid/start";

function writeSsoConfig(dir: string, region: string, tokenCache: Record<string, unknown> = {}) {
  const configPath = path.join(dir, "config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      current: "sso",
      profiles: {
        sso: { mode: "sso", "sso-session-name": SESSION, "account-id": "2100000000", "role-name": "dev" },
      },
      "sso-session": { [SESSION]: { "start-url": START_URL, region } },
    }),
  );
  const cacheName = `${crypto
    .createHash("sha1")
    .update(JSON.stringify({ start_url: START_URL, session_name: SESSION }))
    .digest("hex")}.json`;
  const cacheDir = path.join(dir, "sso", "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, cacheName),
    JSON.stringify({
      access_token: "tok",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      ...tokenCache,
    }),
  );
  return configPath;
}

// access_token 已过期的缓存：触发 refreshSsoAccessToken（cloudidentity-oauth.*）分支。
function writeExpiredSsoConfig(dir: string, region: string) {
  return writeSsoConfig(dir, region, {
    expires_at: new Date(Date.now() - 3600_000).toISOString(),
    refresh_token: "rt",
    client_id: "cid",
    client_secret: "secret",
  });
}

describe("CLIConfigCredentialProvider SSO region validation", () => {
  let dir: string;
  let httpsRequest: jest.SpyInstance;
  let httpRequest: jest.SpyInstance;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = process.env;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sso-endpoint-"));
    // 隔离本机/CI 的 profile 选择与 HOME，保证只读取测试写入的配置。
    process.env = { ...savedEnv, HOME: dir };
    delete process.env.BYTEPLUS_PROFILE;
    delete process.env.BYTEPLUS_CLI_PROFILE;
    delete process.env.USERPROFILE;
    httpsRequest = jest.spyOn(https, "request").mockImplementation(() => {
      throw new Error("network blocked in test");
    });
    httpRequest = jest.spyOn(http, "request").mockImplementation(() => {
      throw new Error("network blocked in test");
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = savedEnv;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function provider(region: string) {
    const configFilePath = writeSsoConfig(dir, region);
    jest.spyOn(envUtils, "loadEnv").mockReturnValue({ credentials: { configFilePath } } as any);
    return new CLIConfigCredentialProvider();
  }

  function providerWithExpiredToken(region: string) {
    const configFilePath = writeExpiredSsoConfig(dir, region);
    jest.spyOn(envUtils, "loadEnv").mockReturnValue({ credentials: { configFilePath } } as any);
    return new CLIConfigCredentialProvider();
  }

  test.each(invalidCases.filter(([v]) => v.trim() === v))(
    "rejects sso-session region %j before any request",
    async (region, quoted, reason) => {
      let err: unknown;
      try {
        await provider(region).resolveCredentials();
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(EndpointValidationError);
      expect((err as EndpointValidationError).code).toBe("InvalidRegion");
      expect((err as EndpointValidationError).message).toBe(messageOf("region", quoted, reason));
      expect(httpsRequest).not.toHaveBeenCalled();
      expect(httpRequest).not.toHaveBeenCalled();
    },
  );

  test("control: a legal region reaches the regional cloudidentity host", async () => {
    await expect(provider("ap-southeast-1").resolveCredentials()).rejects.toThrow("network blocked in test");
    expect(httpsRequest).toHaveBeenCalledTimes(1);
    expect(httpsRequest.mock.calls[0][0].hostname).toBe("cloudidentity-portal.ap-southeast-1.bytepluses.com");
  });

  test("control: a legal region reaches the oauth refresh host when the cached access token is expired", async () => {
    await expect(providerWithExpiredToken("ap-southeast-1").resolveCredentials()).rejects.toThrow(
      "network blocked in test",
    );
    expect(httpsRequest).toHaveBeenCalledTimes(1);
    expect(httpsRequest.mock.calls[0][0].hostname).toBe("cloudidentity-oauth.ap-southeast-1.bytepluses.com");
    expect(httpsRequest.mock.calls[0][0].path).toBe("/token");
  });
  // 内联 STS 缓存未过期时同样必须校验 region（N-11）：缓存命中不发请求，但配置错误应第一时间暴露。
  describe("with an unexpired inline STS cache", () => {
    function writeCachedConfig(region: string, withSession: boolean) {
      const configPath = path.join(dir, "config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          current: "sso",
          profiles: {
            sso: {
              mode: "sso",
              ...(withSession ? { "sso-session-name": SESSION } : { region }),
              "access-key": "AKID",
              "secret-key": "SK",
              "session-token": "TOKEN",
              "sts-expiration": Math.floor(Date.now() / 1000) + 3600,
            },
          },
          ...(withSession ? { "sso-session": { [SESSION]: { "start-url": START_URL, region } } } : {}),
        }),
      );
      jest.spyOn(envUtils, "loadEnv").mockReturnValue({ credentials: { configFilePath: configPath } } as any);
      return new CLIConfigCredentialProvider();
    }

    test.each(invalidCases.filter(([v]) => v.trim() === v))(
      "rejects sso-session region %j even though the cache is still valid",
      async (region, quoted, reason) => {
        let err: unknown;
        try {
          await writeCachedConfig(region, true).resolveCredentials();
        } catch (e) {
          err = e;
        }
        expect(err).toBeInstanceOf(EndpointValidationError);
        expect((err as EndpointValidationError).code).toBe("InvalidRegion");
        expect((err as EndpointValidationError).message).toBe(messageOf("region", quoted, reason));
        expect(httpsRequest).not.toHaveBeenCalled();
        expect(httpRequest).not.toHaveBeenCalled();
      },
    );

    test("rejects an illegal profile region when no sso-session is configured", async () => {
      await expect(writeCachedConfig("evil.com/x", false).resolveCredentials()).rejects.toBeInstanceOf(
        EndpointValidationError,
      );
    });

    test("control: a legal region still hits the cache without any request", async () => {
      const cred = await writeCachedConfig("ap-southeast-1", true).resolveCredentials();
      expect(cred.accessKeyId).toBe("AKID");
      expect(cred.sessionToken).toBe("TOKEN");
      expect(httpsRequest).not.toHaveBeenCalled();
      expect(httpRequest).not.toHaveBeenCalled();
    });

    test("control: cache hit without a resolvable sso-session still works (default region)", async () => {
      const configPath = path.join(dir, "config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          current: "sso",
          profiles: {
            sso: { mode: "sso", "access-key": "AKID", "secret-key": "SK", "sts-expiration": Math.floor(Date.now() / 1000) + 3600 },
          },
        }),
      );
      jest.spyOn(envUtils, "loadEnv").mockReturnValue({ credentials: { configFilePath: configPath } } as any);
      const cred = await new CLIConfigCredentialProvider().resolveCredentials();
      expect(cred.accessKeyId).toBe("AKID");
      expect(httpsRequest).not.toHaveBeenCalled();
    });
  });
});
