[← Overview](0-Overview.md) | Environment Variables [(中文)](EnvironmentVariables-zh.md)

---

## Environment Variables

This page lists all environment variables supported by the SDK for deployment/CI injection.

### Setup

#### Linux / macOS

Temporary (current shell):

```shell
export BYTEPLUS_ACCESS_KEY=your-ak
export BYTEPLUS_SECRET_KEY=your-sk
# optional
export BYTEPLUS_SESSION_TOKEN=your-session-token
```

Persistent: Add `export` lines to `~/.bashrc`, `~/.zshrc`, etc.

Verify: `echo $BYTEPLUS_ACCESS_KEY` should return the expected value.

#### Windows

Command line (run as administrator):

```cmd
setx BYTEPLUS_ACCESS_KEY your-ak /M
setx BYTEPLUS_SECRET_KEY your-sk /M
setx BYTEPLUS_SESSION_TOKEN your-session-token /M
```

`/M` means system-level; omit `/M` for user-level.

---

### Credentials

#### Basic AK/SK/Token

| Variable                   | Description                 | Required |
| -------------------------- | --------------------------- | :------: |
| `BYTEPLUS_ACCESS_KEY`    | Access Key                  |    ✅    |
| `BYTEPLUS_SECRET_KEY`    | Secret Key                  |    ✅    |
| `BYTEPLUS_SESSION_TOKEN` | STS temporary Session Token |    ❌    |

#### OIDC (AssumeRoleWithOIDC)

| Variable                            | Description                  | Required |
| ----------------------------------- | ---------------------------- | :------: |
| `BYTEPLUS_OIDC_ROLE_TRN`          | Role TRN to assume           |    ✅    |
| `BYTEPLUS_OIDC_TOKEN_FILE`        | OIDC token file path         |    ✅    |
| `BYTEPLUS_OIDC_ROLE_SESSION_NAME` | Role session name            |    ❌    |
| `BYTEPLUS_OIDC_STS_ENDPOINT`      | Custom STS endpoint          |    ❌    |
| `BYTEPLUS_OIDC_ROLE_POLICY`       | Session policy (JSON string) |    ❌    |

#### SAML (AssumeRoleWithSAML)

| Variable                       | Description                     | Required |
| ------------------------------ | ------------------------------- | :------: |
| `BYTEPLUS_SAML_ROLE_TRN`     | Role TRN to assume              |    ✅    |
| `BYTEPLUS_SAML_ACCOUNT_ID`   | BytePlus account ID           |    ✅    |
| `BYTEPLUS_SAML_PROVIDER_TRN` | SAML identity provider TRN      |    ✅    |
| `BYTEPLUS_SAML_ASSERTION`    | SAML assertion (Base64 encoded) |    ✅    |
| `BYTEPLUS_SAML_ENDPOINT`     | Custom STS endpoint             |    ❌    |
| `BYTEPLUS_SAML_POLICY`       | Session policy (JSON string)    |    ❌    |

#### ECS Instance Role (IMDS)

| Variable                           | Description                                                              | Default |
| ---------------------------------- | ------------------------------------------------------------------------ | ------- |
| `BYTEPLUS_ECS_METADATA`          | Specify ECS instance role name; if unset, auto-detected from IMDS         | -       |
| `BYTEPLUS_ECS_METADATA_DISABLED` | Set to `true` to disable IMDS credential retrieval                       | -       |

#### CLI Config File

| Variable                     | Description          | Default                     |
| ---------------------------- | -------------------- | --------------------------- |
| `BYTEPLUS_CLI_CONFIG_FILE` | CLI config file path | `~/.byteplus/config.json` |

---

### Endpoint & Network

| Variable                          | Description                                                  | Default |
| --------------------------------- | ------------------------------------------------------------ | ------- |
| `BYTEPLUS_ENABLE_DUALSTACK`           | Enable dual-stack (IPv4+IPv6), set to `true` to enable       | `false` |

---

### HTTP Proxy

When either `BYTEPLUS_PROXY_HOST` or `BYTEPLUS_PROXY_PORT` is set, the SDK automatically enables proxy.

| Variable              | Description                       | Default                     |
| --------------------- | --------------------------------- | --------------------------- |
| `BYTEPLUS_PROXY_PROTOCOL` | Proxy protocol (`http` / `https`) | `http`                      |
| `BYTEPLUS_PROXY_HOST`     | Proxy host address                | `127.0.0.1`                 |
| `BYTEPLUS_PROXY_PORT`     | Proxy port                        | `80` (http) / `443` (https) |

---

### Default Credential Chain Order

When no credentials are explicitly configured, `DefaultCredentialProvider` tries providers in the following order (first success wins):

| Order | Provider                              | Dependent Environment Variables                                                                 |
| :---: | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
|   1   | EnvironmentVariableCredentialProvider | `BYTEPLUS_ACCESS_KEY` / `BYTEPLUS_ACCESS_KEY_ID` / `BYTEPLUS_ACCESS_KEY` + corresponding SK |
|   2   | OidcCredentialProvider                | `BYTEPLUS_OIDC_ROLE_TRN` + `BYTEPLUS_OIDC_TOKEN_FILE`                                       |
|   3   | CLIConfigCredentialProvider           | `BYTEPLUS_CLI_CONFIG_FILE` (optional)                                                         |
|   4   | EcsRoleCredentialProvider             | `BYTEPLUS_ECS_METADATA` (optional), skipped when `BYTEPLUS_ECS_METADATA_DISABLED=true`      |

---

### Priority Summary

| Configuration Item   | Priority (high → low)                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| AK/SK/Token          | `BYTEPLUS_*` > `BYTEPLUS_*_ID` > `BYTEPLUS_*`                               |
| OIDC STS Endpoint    | Constructor parameter `host` > `BYTEPLUS_OIDC_STS_ENDPOINT`                   |
| SAML STS Endpoint    | Constructor parameter `host` > `BYTEPLUS_SAML_ENDPOINT`                       |
| CLI config file path | `BYTEPLUS_CLI_CONFIG_FILE` > `~/.byteplus/config.json`                      |
| ECS Role name        | Constructor parameter `roleName` > `BYTEPLUS_ECS_METADATA` > IMDS auto-detect |
| DualStack            | Constructor parameter `useDualStack` > `BYTEPLUS_ENABLE_DUALSTACK`                  |
| Proxy                | Constructor parameter `httpOptions.proxy` > `BYTEPLUS_PROXY_*`                      |

---

### Legacy Compatible Variables (`BYTEPLUS_*`)

Earlier SDKs used the `BYTEPLUS_*` prefix. When the equivalent `BYTEPLUS_*` variable is not set, the following variables serve as fallback. **New code should use `BYTEPLUS_*` exclusively.**

| Variable                                               | Equivalent `BYTEPLUS_*`  | Node.js | Go  | Python |
| ------------------------------------------------------ | -------------------------- | :-----: | :-: | :----: |
| `BYTEPLUS_ACCESS_KEY_ID` / `BYTEPLUS_ACCESS_KEY`     | `BYTEPLUS_ACCESS_KEY`    |   ✅    | ✅  |   ❌   |
| `BYTEPLUS_SECRET_ACCESS_KEY` / `BYTEPLUS_SECRET_KEY` | `BYTEPLUS_SECRET_KEY`    |   ✅    | ✅  |   ❌   |
| `BYTEPLUS_SESSION_TOKEN`                              | `BYTEPLUS_SESSION_TOKEN` |   ✅    | ✅  |   ❌   |

Fallback priority: `BYTEPLUS_*` > `BYTEPLUS_*_ID` > `BYTEPLUS_*`

---

### Related Documentation

- [Credentials](1-Credentials.md) — Code-level usage of each Provider
- [Endpoint Configuration](2-Endpoint.md) — DualStack, bootstrap region list details
- [Proxy](4-Proxy.md) — Proxy configuration code-level usage

---

[← Overview](0-Overview.md) | Environment Variables [(中文)](EnvironmentVariables-zh.md)
