[← Transport](3-Transport.md) | Proxy [(中文)](4-Proxy-zh.md) | [Timeouts →](5-Timeout.md)

---

## HTTP(S) Proxy Configuration

> **Default**
>
> - No proxy

### Configure in Code

```typescript
const client = new ECSClient({
  region: "ap-southeast-1",
  httpOptions: {
    proxy: {
      protocol: "http",
      host: "127.0.0.1",
      port: 8888,
    },
  },
});
```

### Use Environment Variables

The SDK reads the following environment variables:

- `BYTEPLUS_PROXY_PROTOCOL`: Proxy protocol (`http` or `https`)
- `BYTEPLUS_PROXY_HOST`: Proxy host
- `BYTEPLUS_PROXY_PORT`: Proxy port

Priority: Code configuration > environment variables.

---

[← Transport](3-Transport.md) | Proxy [(中文)](4-Proxy-zh.md) | [Timeouts →](5-Timeout.md)
