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

   - Service missing from the map: the default addressing pipeline **falls back to the default open endpoint** `open.ap-southeast-1.byteplusapi.com` so the request does not crash. See [Unknown services](#unknown-services).

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

If the requested service is not registered in `defaultEndpoint`, the default addressing pipeline does **not** throw. To keep older callers working, it falls back to the default open endpoint `open.ap-southeast-1.byteplusapi.com` (this fallback ignores `region` / `useDualStack`).

This means an unregistered service will not fail fast — it will silently target the open endpoint, which is usually not what you want. If a request unexpectedly goes to `open.ap-southeast-1.byteplusapi.com`, the service is likely not carried by the installed SDK. In that case:

- Upgrade the SDK dependency so the service is registered, or
- Set the endpoint explicitly via `host`.

> The internal `resolveDefaultEndpoint` helper does throw `ServiceEndpointInfoMissingError` for unregistered services, but it is not on the default Client request path and is **not** exported from the package root. Do not rely on catching it from `@byteplus/sdk-core`.

---

[← Credentials](1-Credentials.md) | Endpoint Configuration [(中文)](2-Endpoint-zh.md) | [Transport →](3-Transport.md)
