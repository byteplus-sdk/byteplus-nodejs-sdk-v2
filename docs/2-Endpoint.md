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

   - Service missing from the map: the default addressing pipeline used by the Client **falls back to the default open endpoint** `open.ap-southeast-1.byteplusapi.com`, so requests do not crash. The internal `resolveDefaultEndpoint` resolver instead throws `ServiceEndpointInfoMissingError` (exported from `@byteplus/sdk-core`) with a message like `byteplus-sdk: service endpoint info missing: service '<xxx>' not registered`. See [Unknown services](#unknown-services).

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

##### Code Example

```typescript
import { ECSClient } from "@byteplus/ecs";

// Resolves to: ecs.ap-southeast-1.byteplus-api.com (DualStack suffix)
const client = new ECSClient({
  region: "ap-southeast-1",
  useDualStack: true, // also honors env BYTEPLUS_ENABLE_DUALSTACK=true
});
```

##### Unknown services

Two code paths behave differently for an unregistered service, matching the implementation:

- **Default Client path** (`getDefaultEndpointByServiceInfo`, used by the endpoint middleware): does **not** throw. To keep older callers working, it falls back to the default open endpoint `open.ap-southeast-1.byteplusapi.com` (this fallback ignores `region` / `useDualStack`). A request unexpectedly targeting `open.ap-southeast-1.byteplusapi.com` usually means the installed SDK does not carry that service.
- **Internal resolver** (`resolveDefaultEndpoint`): throws `ServiceEndpointInfoMissingError` for an unregistered service. Only the error class is exported from `@byteplus/sdk-core`, so you match it by type:

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

> Note: `resolveDefaultEndpoint` itself is internal and **not** exported from the package root; only `ServiceEndpointInfoMissingError` is. Because the default Client request path uses the fallback wrapper above, in practice `client.send()` will not throw this error for an unknown service — it silently targets the open endpoint instead.

---

[← Credentials](1-Credentials.md) | Endpoint Configuration [(中文)](2-Endpoint-zh.md) | [Transport →](3-Transport.md)
