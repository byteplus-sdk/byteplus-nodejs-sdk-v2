English | [中文](README.md)

# BytePlus SDK for Node.js

## Requirements

- Node.js >= 18

## Installation

Recommended to use `pnpm` for installation. `npm` and `yarn` are also supported.

1. Installation Core Packages

```bash
# pnpm
pnpm add @byteplus/sdk-core

# npm
npm install @byteplus/sdk-core

# yarn
yarn add @byteplus/sdk-core
```

2. Installation Service Packages

   Take installing ECS service SDK package as an example:

```bash
# pnpm
pnpm add @byteplus/ecs

# npm
npm install @byteplus/ecs

# yarn
yarn add @byteplus/ecs
```

## Environment Variables

The SDK automatically reads the following environment variables as access credentials:

- `BYTEPLUS_ACCESS_KEY_ID` or `BYTEPLUS_ACCESS_KEY`: Access Key ID
- `BYTEPLUS_SECRET_ACCESS_KEY` or `BYTEPLUS_SECRET_KEY`: Secret Access Key

After configuring environment variables, you do not need to configure credentials in the code again.

```bash
export BYTEPLUS_ACCESS_KEY_ID="YOUR_AK"
export BYTEPLUS_SECRET_ACCESS_KEY="YOUR_SK"
```

## Quick Start

The following example shows how to initialize the client and send a request.
Install the corresponding service SDK package (e.g., `@byteplus/ecs`).

```bash
# pnpm
pnpm add @byteplus/ecs
```

```typescript
import { ECSClient, DescribeZonesCommand } from "@byteplus/ecs"; // Need to install the corresponding service package

// 1. Use AK/SK from environment variables and specify Region
const client = new ECSClient({
  region: "ap-southeast-1",
});

// 2. Or explicitly pass AK/SK in the code
// const client = new ECSClient({
//   accessKeyId: "YOUR_AK",
//   secretAccessKey: "YOUR_SK",
//   region: "ap-southeast-1",
// });

async function main() {
  try {
    // Send request (refer to service SDK documentation for specific Commands)
    const command = new DescribeZonesCommand({});
    const response = await client.send(command);
    console.log(response);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

For more code examples, please refer to: [SDK Integration Documentation](./SDK_Integration.md)

## Security and privacy

This project takes security seriously.
For vulnerability reporting and supported versions, see [SECURITY.md](SECURITY.md)
