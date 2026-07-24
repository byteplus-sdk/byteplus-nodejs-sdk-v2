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

   Whether Go China applies is decided by the service itself and cannot be overridden. Regions are normalized with `trim().toLowerCase()` before matching, so `CN-Beijing`, `  cn-beijing  ` and `cn-beijing` are treated identically.

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

##### `customBootstrapRegion` / `BYTEPLUS_BOOTSTRAP_REGION_LIST_CONF` (Deprecated)

> **⚠️ Deprecated**: the `customBootstrapRegion` field on `ClientConfig` and the `BYTEPLUS_BOOTSTRAP_REGION_LIST_CONF` environment variable are **deprecated** and **no longer participate** in the default addressing pipeline. The field is retained only for API-source compatibility and is treated as a no-op at runtime. **Do not use it in new code.** Existing callers should switch to `region` + `useDualStack` and let the SDK auto-resolve the endpoint, or override it explicitly via `host`.

##### Code Example

```typescript
import { ECSClient } from "@byteplus/ecs";

// Resolves to: ecs.ap-southeast-1.byteplusapi.com
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
    // err.service carries the offending service name
    // The installed SDK likely does not know this service.
    // Upgrade the dependency or set the endpoint explicitly.
    throw err;
  }
  throw err;
}
```

When you hit this error, first try upgrading the SDK. If the service is genuinely not carried by the SDK yet, set the endpoint explicitly via `host`.

### Standard Endpoint Addressing

| Global Service | DualStack | Format |
|---|---|---|
| Yes | Yes | `{Service}.byteplus-api.com` |
| Yes | No | `{Service}.byteplusapi.com` |
| No | Yes | `{Service}.{region}.byteplus-api.com` |
| No | No | `{Service}.{region}.byteplusapi.com` |

Standard resolution never appends the Go China `.cn` suffix. If you need `.cn`, use the default resolver (or set the endpoint explicitly).

---

[← Credentials](1-Credentials.md) | Endpoint Configuration [(中文)](2-Endpoint-zh.md) | [Transport →](3-Transport.md)
