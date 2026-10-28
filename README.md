# scnts

TypeScript tools for reading S4 League/Xero `.scn` scene files and viewing their contents in a browser. The repository contains a scene parser, a local resource API, example viewers built with Three.js and Babylon.js, and a basic asset validator.

See the [SCN binary format reference](SCN_FORMAT.md) for field layouts, node types, version branches, animation data, and known format limitations.

## Features

- Read scene hierarchies, geometry, materials, lights, bones, and animation key data.
- Collect referenced asset names and resolve texture files beside a scene.
- Serve parsed scenes and map definitions as JSON or MessagePack.
- Explore assets through Three.js, Babylon.js, or a React/Mantine interface backed by Babylon.js.

## Requirements

- Node.js and npm. Node.js 20 is a suitable baseline for the included toolchain.
- A local, extracted resource directory containing the scenes and textures you want to inspect.

For the sample server and viewers, the resource directory should have this layout:

```text
resources/
├── xml/
│   └── map.x7
├── mapinfo/
│   ├── *.ini
│   └── develop/
│       └── *.ini
└── model/
    ├── background/
    │   └── *.scn
    └── ...
```

`xml/map.x7` must be readable XML: the server reads it during startup. Scene textures should be available at the locations referenced by the scene files. Supply these resources separately.

## Quick start

Run the following commands from the repository root in PowerShell.

### 1. Install the root dependencies

```powershell
npm install
```

The samples have their own dependencies and import parser code from the root project, so install the root dependencies even when running a sample.

### 2. Configure and start the resource server

```powershell
cd samples/server
npm install
Copy-Item config.ts.example config.ts
```

Edit `samples/server/config.ts` to set your resource directory:

```typescript
export default {
    ip: '127.0.0.1',
    port: 4444,
    path: 'D:/Assets/resources',
};
```

Then start the server:

```powershell
npm start
```

Keep this terminal running. The default API address is `http://127.0.0.1:4444`.

### 3. Start a viewer

In another terminal, from the repository root:

```powershell
cd samples/client-mantine
npm install
npm run dev
```

Open the local URL printed by Vite. You can substitute `samples/client-three` or `samples/client-babylon` for another viewer.

The viewers use `http://127.0.0.1:4444` in their `src/Utility/ResourceClient.ts` files. If you change the API address, update the selected viewer's resource client and any texture request URLs that use the old address. Map preview thumbnails also use `https://cdn.xero.gg`.

## Use the parser directly

Create a TypeScript file in the repository root, for example `example.ts`:

```typescript
import { writeFileSync } from 'fs';
import { NsScene } from './src/Scene/NsScene';

const scene = NsScene.LoadFromFile('D:/Assets/resources/model/background/example.scn');
if (scene === null) {
    throw new Error('Failed to load scene');
}

console.log(scene.GetAssetNames());
writeFileSync('scene.json', JSON.stringify(scene, null, 2));
```

Run it with:

```powershell
npx ts-node example.ts
```

`NsScene.LoadFromBuffer(buffer)` also accepts in-memory scene data. Both entry points detect encrypted scene buffers automatically. Extended scene metadata is available as `scene.header`; sphere nodes expose `center` and `radius` alongside the legacy `unk` vector.

Lights use the standard field order by default. For assets requiring the alternate compatibility layout, pass `{ lightLayout: 'alternate' }` as the second argument to `LoadFromFile` or `LoadFromBuffer`.

`LoadFromFile` performs synchronous file reads and can throw on file or parsing errors. `GetAssetNames()` collects referenced names and resolves texture extensions relative to the scene directory, trying `.dds`, `.png`, `.tga`, `.jpg`, and `.bmp` in that order.

The root `npm start` runs `index.ts`, which currently uses a hardcoded local scene path. Edit that path before using it; it does not accept a filename argument.

## Resource API

All endpoints use `GET`.

| Endpoint | Query parameters | Result |
| --- | --- | --- |
| `/scn/models` | `responseType` | Scene paths relative to the resource directory. |
| `/scn/get-bginfo-filenames` | `responseType`, optional `extended=1` | Map definition filenames; extended results include preview URLs. |
| `/scn/bginfo` | `filename`, `responseType` | Array of `{ scene, assets }` objects for a map's SKY, STATIC, and DYNAMIC sections. |
| `/scn/json` | `path`, `responseType` | One `{ scene, assets }` object; `path` is relative to the resource directory. |
| `/resource` | `filename`, `sceneFilePath` | Raw texture bytes resolved relative to the scene file. |

Scene and listing endpoints accept `responseType=json` (default) or `responseType=msgpack`. For example:

```text
http://127.0.0.1:4444/scn/models
http://127.0.0.1:4444/scn/json?path=model/background/example.scn&responseType=json
```

The server is a local development sample. It has no authentication, accepts file paths in requests, and enables permissive CORS; keep it bound to localhost.

## Validator

From the repository root:

```powershell
cd samples/validator
npm install
Copy-Item config.ts.example config.ts
```

Set `path` in `config.ts` to your resource directory, as with the server, then run:

```powershell
npm start
```

The validator scans `model/**/*.scn`, attempts to load each file, and reports loading errors and mismatched vertex/normal counts. Most other node-specific validation functions are currently placeholders, so this is a basic diagnostic tool.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/Scene/` | Scene loading, nodes, geometry, materials, bones, and format constants. |
| `src/Animation/` | Transform, morph, and float animation key data. |
| `src/IO/` | Binary reader and writer utilities. |
| `src/Common/` | Shared math, color, and segment types. |
| `samples/server/` | Fastify resource API. |
| `samples/client-three/` | Three.js viewer with an ImGui interface. |
| `samples/client-babylon/` | Babylon.js viewer. |
| `samples/client-mantine/` | React/Mantine viewer using Babylon.js. |
| `samples/validator/` | Batch scene loading and basic geometry checks. |

## Development notes

Each package defines `npm run build`. Viewer packages also provide `npm run preview` for their production builds. The root build compiles the parser, root demo, and tests; sample apps use their own configurations and dependencies.

Run `npm test` for the parser build and binary-fixture tests. The fixtures cover headers, supported node types, geometry versions, animation alignment, encryption, string encoding, and binary I/O. They do not establish rendering compatibility with every asset variant.

Full scene writing remains incomplete. Shape, sphere, box, and bone-system payload writers are supported; geometry, group, bone, and light saves return `false`. Binary writer helpers support little-endian values, seeking, and EUC-KR strings. Format compatibility and rendering should also be checked against your own assets.
