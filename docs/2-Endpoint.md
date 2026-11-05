[← Credentials](1-Credentials.md) | Endpoint Configuration [(中文)](2-Endpoint-zh.md) | [Transport →](3-Transport.md)

---

## Endpoint Configuration

> **Default**
>
> When no `host` is specified, the SDK uses [Automatic Endpoint Addressing](#automatic-endpoint-addressing).

### Custom Endpoint

Directly specify `host` in the client configuration to force the SDK to send all requests to that address. This has the highest priority and skips every subsequent resolution step.

```typescript
const client = new ECSClient({
  host: "open.ap-southeast-1.byteplusapi.com",
  region: "ap-southeast-1",
});
```

### Custom RegionId

```typescript
const client = new ECSClient({
  region: "ap-southeast-1",
});
```

### Automatic Endpoint Addressing

> **Default**
>
> Automatic addressing is enabled by default. There is no need to specify an endpoint manually.

BytePlus provides a flexible endpoint resolution mechanism. The SDK builds the endpoint from the service name, region and the service's Go China flag, and also supports DualStack.

#### Default Endpoint Addressing

##### Resolution Logic

1. **Service registration check**

   Every service in the built-in map carries an `IsGlobal` and a `GoChinaEnabled` bool. The SDK builds the endpoint following the rules below.

   - Service missing from the map: `resolveDefaultEndpoint` throws `ServiceEndpointInfoMissingError` (re-exported from `@byteplus/sdk-core`) with a message like `byteplus-sdk: service endpoint info missing: service '<xxx>' not registered`. See [Error handling](#error-handling).

   Built-in service map: [`packages/sdk-core/src/utils/endpoint.ts`](../packages/sdk-core/src/utils/endpoint.ts) `defaultEndpoint`.

2. **DualStack support (IPv6)**

   Enable via the `useDualStack: true` argument or env var `BYTEPLUS_ENABLE_DUALSTACK=true`. Priority: `useDualStack` > `BYTEPLUS_ENABLE_DUALSTACK`.

   When enabled, the domain suffix changes from `byteplusapi.com` to `byteplus-api.com`.

3. **Go China suffix**

   When a service entry has `GoChinaEnabled=true` and the request region is in the Chinese mainland (a `cn-*` prefix but not one of the non-mainland regions such as `cn-hongkong`), the resolver appends the `.cn` suffix.

   Whether Go China applies is decided by the service itself and cannot be overridden. Regions are normalized with `toLowerCase()` before matching, so `CN-Beijing` and `cn-beijing` are treated identically; a region with leading or trailing whitespace (e.g. `  cn-beijing  `) is no longer trimmed and throws `InvalidRegion` instead. See [Region and service validation](#region-and-service-validation).

4. **Endpoint construction**

   - **Global services (e.g., `IAM`, `Billing`)**: `<service>.byteplusapi.com` (or `byteplus-api.com` when DualStack is enabled; `.cn` is appended when Go China applies).
   - **Regional services (e.g., `ECS`, `RDS`)**: `<service>.<region>.byteplusapi.com` (DualStack / Go China rules identical to global services).

   > Service codes are normalized when building the domain: uppercase → lowercase, underscore `_` → hyphen `-`. For example, `rds_mysql` → `rds-mysql.ap-southeast-1.byteplusapi.com`.

##### Decision Table

The table lists every effective combination. `RegionType` is derived from the service's `IsGlobal` flag; "Region is Go China" refers to the request region.

| RegionType | GoChinaEnabled | Region is Go China | Endpoint | Region embedded |
|---|---|---|---|---|
| Global | true | yes | `{service}.byteplusapi.com.cn` | no |
| Global | true | no | `{service}.byteplusapi.com` | no |
| Global | false | any | `{service}.byteplusapi.com` | no |
| Regional | true | yes | `{service}.{region}.byteplusapi.com.cn` | yes |
| Regional | true | no | `{service}.{region}.byteplusapi.com` | yes |
| Regional | false | any | `{service}.{region}.byteplusapi.com` | yes |

When DualStack is enabled, replace every occurrence of `byteplusapi.com` in the table with `byteplus-api.com`.

##### Code Example

```typescript
import { ECSClient } from "@byteplus/ecs";

// Resolves to: ecs.ap-southeast-1.byteplus-api.com (DualStack suffix)
const client = new ECSClient({
  region: "ap-southeast-1",
  useDualStack: true, // also honors env BYTEPLUS_ENABLE_DUALSTACK=true
});
```

##### Error handling
If the requested service is not registered in `defaultEndpoint`, the SDK throws `ServiceEndpointInfoMissingError` on the first default endpoint resolution, with a message like `byteplus-sdk: service endpoint info missing: service '<xxx>' not registered`. Detect it with:

```typescript
import { ServiceEndpointInfoMissingError } from "@byteplus/sdk-core";

try {
  await client.send(command);
} catch (err) {
  if (err instanceof ServiceEndpointInfoMissingError) {
    // err.service carries the offending service name.
    // Upgrade the SDK dependency, or set the endpoint explicitly via `host`.
    throw err;
  }
  throw err;
}
```

When you hit this, first try upgrading the SDK. If the service is genuinely not carried yet, set the endpoint explicitly via `host`.

##### Region and service validation

The region and service are embedded in the endpoint host name and in the signing credential scope. To prevent endpoint injection (SSRF), the SDK requires each of them to be a single host name label:

- Only ASCII letters, digits, `-` and `_` are allowed.
- It must start with a letter and must not end with `-` or `_` (equivalent regex: `^[A-Za-z]([A-Za-z0-9_-]*[A-Za-z0-9])?$`).
- An empty string, `undefined` or `null` is treated as unset and is not validated (when no `region` is configured, the client uses the default `ap-southeast-1`).
- A non-string value is converted with `String()` before validation; for example, the number `123` is rejected because it does not start with a letter.

When and where the check runs:

- `Client.send` / `Client.presign`: when no explicit `host` is set, the check runs before the whole middleware stack (endpoint resolution, credential resolution, signing and any custom middleware), so an invalid value neither triggers credential resolution nor sends a request.
- Default endpoint resolution: both `resolveDefaultEndpoint` and `getDefaultEndpointByServiceInfo` run the check before every branch, so an invalid value never falls back to the default open endpoint. In `resolveDefaultEndpoint` an invalid value is reported ahead of `ServiceEndpointInfoMissingError` (which only `resolveDefaultEndpoint` throws); for an invalid value, `getDefaultEndpointByServiceInfo` throws the `EndpointValidationError` from validation as is, without wrapping it.
- RDS `buildAuthToken`: `region` is always validated, whether or not `host` is set (this entry point writes `host` into `X-HOST`, clears `host` and resolves the endpoint from `region`), and the check runs before `client.config` is modified.
- SSO mode of the CLI config file: the SSO region (which is part of the `cloudidentity` host name) is validated before the inlined STS credential cache is used and before any request is sent.

When `host` is set explicitly (except for RDS `buildAuthToken`), the SDK does not build a host name from region / service, so the check is skipped.

On failure the SDK throws `EndpointValidationError` (extends `Error`, `name` is `"EndpointValidationError"`). Its `code` is either `ErrCodeInvalidRegion` (`"InvalidRegion"`) or `ErrCodeInvalidService` (`"InvalidService"`). The `message` looks like:

```text
invalid region "ap-southeast-1@127.0.0.1": illegal character at index 14, region must start with a letter, end with a letter or digit, and contain only letters, digits, '-' and '_'
```

`EndpointValidationError`, `ErrCodeInvalidRegion`, `ErrCodeInvalidService` and the validators `validateRegion`, `validateService` and `validateServiceAndRegion` are exported from `@byteplus/sdk-core`; the validators can also be used to check external input up front.

```typescript
import {
  EndpointValidationError,
  ErrCodeInvalidRegion,
  ErrCodeInvalidService,
} from "@byteplus/sdk-core";

try {
  await client.send(command);
} catch (err) {
  if (err instanceof EndpointValidationError) {
    if (err.code === ErrCodeInvalidRegion) {
      // Invalid region, e.g. "ap-southeast-1@127.0.0.1" or "  ap-southeast-1  "
    } else if (err.code === ErrCodeInvalidService) {
      // Invalid service
    }
  }
  throw err;
}
```

> **Behavior change**
>
> - A region with leading or trailing whitespace (e.g. `"  cn-beijing  "`) is no longer trimmed automatically and now throws `InvalidRegion`. Previously such a value was trimmed for endpoint resolution while the signing credential scope used the original value, so the request was already rejected by the server with `InvalidAuthorization`. Regions read from the CLI config file are still trimmed first and are not affected.
> - In SSO mode of the CLI config file, the region is now validated before the STS temporary credentials inlined in the profile are used. Previously, unexpired inlined credentials were returned directly without validating the region, and an invalid region only threw once they expired; now an invalid region throws immediately. A cache hit sends no request, so this is not an SSRF issue; the change only surfaces configuration errors earlier.


---

[← Credentials](1-Credentials.md) | Endpoint Configuration [(中文)](2-Endpoint-zh.md) | [Transport →](3-Transport.md)
