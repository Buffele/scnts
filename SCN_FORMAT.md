# SCN binary structure

This document describes S4 League/Xero SCN binary layouts, field meanings, scene hierarchy, and animation behavior. TypeScript property names are included where they differ from the serialized data's meaning. Unsupported variants and unresolved fields are identified explicitly.

## Contents

- [Binary conventions](#binary-conventions)
- [File header and node records](#file-header-and-node-records)
- [Common node payload](#common-node-payload)
- [SceneGroup](#scenegroup)
- [Geometry](#geometry)
- [Animation blocks](#animation-blocks)
- [Bone](#bone)
- [BoneSystem](#bonesystem)
- [ShapeNode](#shapenode)
- [BoxNode](#boxnode)
- [SphereNode](#spherenode)
- [LightNode](#lightnode)
- [Enums](#enums)
- [External resources and in-memory representation](#external-resources-and-in-memory-representation)
- [Compatibility and implementation limits](#compatibility-and-implementation-limits)
- [Encrypted scene buffers](#encrypted-scene-buffers)

## Binary conventions

Source: [NsBinaryReader.ts](src/IO/NsBinaryReader.ts), [NsMath.ts](src/Common/NsMath.ts).

All tables list fields in on-disk order. All multibyte numbers are **little-endian**. No automatic padding or alignment is applied: a four-byte number can immediately follow a one-byte flag or a variable-length string.

| Notation | Size in bytes | Encoding |
| --- | ---: | --- |
| `u8` | 1 | Unsigned byte. |
| `u16` | 2 | Unsigned integer. |
| `i32` | 4 | Signed integer, used for node type IDs. |
| `u32` | 4 | Unsigned integer. |
| `u64` | 8 | Unsigned integer; represented as JavaScript `bigint`. |
| `f32` | 4 | IEEE 754 single-precision float. |
| `stringz` | Variable | EUC-KR bytes terminated by `00`; the terminator is consumed. |
| `string[1024]` | 1024 | Entire field consumed; EUC-KR decoded up to the first zero byte. |
| `vec2` | 8 | `f32 x, y`. |
| `vec3` | 12 | `f32 x, y, z`. |
| `vec4` | 16 | `f32 x, y, z, w`. |
| `quat` | 16 | `f32 x, y, z, w`. |
| `color` | 16 | `f32 r, g, b, a`; not packed byte colors. |
| `mat4` | 64 | Sixteen floats in the order below. |
| `T[n]` | `sizeof(T) * n` for fixed-size T | Exactly `n` consecutive records, without another count. |

Matrix serialization order is:

```text
m00 m01 m02 m03
m10 m11 m12 m13
m20 m21 m22 m23
m30 m31 m32 m33
```

Matrices use the Direct3D row-vector convention with translation in the fourth row: `m30, m31, m32` (also named `_41, _42, _43`). A position transforms as `p' = p * M`. When converting to a column-vector renderer, account for that convention rather than simply copying element names. Coordinate units and scene-specific axis assumptions require asset validation.

The current `readFixedString` returns an empty string if **no** zero byte occurs within the field, even if the field contains nonzero text. An empty `stringz` occupies one byte. Decimal versions below are stored as `f32`, not decimal text or integer hundredths; readers reproducing version dispatch must account for float representation.

## File header and node records

Source: [NsScene.ts](src/Scene/NsScene.ts).

The first four bytes are a legacy-header check: a value of 1 is the **legacy root node count**, not a format version. Other values select the extended scene header. The TypeScript property `fileVersion` stores this check word rather than the actual scene version. The extended leading word's canonical value remains unresolved. The tables describe the plaintext buffer after any [decryption](#encrypted-scene-buffers).

### Legacy header: first word == 1

| Absolute offset | Type | Field |
| --- | --- | --- |
| `0x00` | `u32` | `uiOldVersionCheck == 1`: legacy root count. |
| `0x04` | Node record | Exactly one root node; no root count is stored. |

### Extended header: first word != 1

| Absolute offset | Type | Field |
| --- | --- | --- |
| `0x00` | `u32` | `uiOldVersionCheck != 1`: extended-header discriminator. |
| `0x04` | `u32` | `SSceneHeader::m_eMaxVersion`: exporter/3ds Max version enum. |
| `0x08` | `u32` | `SSceneHeader::m_uiSceneVersion`. |
| `0x0C` | `u32` | `SSceneHeader::m_uiNumOfSceneNode`: root record count. |
| `0x10` | `u32` | `SSceneHeader::m_uiEmpty1`: reserved; no further semantics established. |
| `0x14` | `u32` | `SSceneHeader::m_uiEmpty2`: reserved; no further semantics established. |
| `0x18` | Node record[root count] | Root nodes. |

The loader routes **every** leading value other than 1 through this header; that does not establish that all such values are valid. TypeScript discards the five extended header fields except for its local root count. `EMaxVersion` is `MAX_NONE=0`, `MAX_8=1`, `MAX_9=2`, `MAX_10=3`, `MAX_2009=4`, `MAX_2010=5`.

A normal node record is:

```text
i32 nodeType
CommonNode common
TypeSpecificPayload payload
```

`nodeType` is a class/component CRC, represented as signed `i32` in TypeScript. It selects the payload parser using the [node IDs](#node-types). Records have no general byte-length prefix. Unknown types throw; the reader cannot skip them. Root nodes and ordinary group children use the same record structure. Alternate group children add wrappers described below.

## Common node payload

Source: [NsSceneNode.ts](src/Scene/NsSceneNode.ts).

Every supported node begins with this payload, immediately after its type ID:

| Type | Field | Meaning |
| --- | --- | --- |
| `stringz` | `name` | Node name. |
| `stringz` | `parent` | Parent name string; not a numeric index. |
| `f32` | `version[0]` | Common/base node version; no dispatch uses it here. |
| `mat4` | `matrix` | Node transform. |

Common payload size is `encodedNameBytes + 1 + encodedParentBytes + 1 + 68`. Including the type ID adds four bytes. The parent string builds the runtime hierarchy: find an already loaded node by parent name and attach there when found, or fall back to the enclosing group otherwise. A group's serialized sequence therefore need not be its direct runtime children. TypeScript preserves the sequence and parent names without rebuilding this hierarchy in the core parser. The node matrix can be decomposed into position, rotation, and scale for animation.

Versions are **per node/layer**: `version[0]`, `version[1]`, and `version[2]` are separate fields; the TypeScript `fileVersion` property is the header discriminator described above. Only read a layer version where its node layout specifies one.

## SceneGroup

Source: [NsSceneGroup.ts](src/Scene/NsSceneGroup.ts).

After the common payload, read `f32 version[1]`.

### Standard layout: version[1] < 0.3

| Type | Field | Condition |
| --- | --- | --- |
| `u32` | `nodeCount` | Always. |
| `stringz` | `reference` | Only when `version[1] >= 0.2`. |
| Node record[nodeCount] | `nodes` | Always; recursively parsed. |

`reference` is a shared-animation scene name (`m_pStrRefAnimScene`). A nonempty value identifies a reference scene whose animation data can be shared with this group. Sharing matches nodes by name and supplies transform, visibility, morph, and virtual-animation data. The TypeScript parser retains the standard-layout string without loading or sharing the referenced scene.

### Alternate Xero layout: version[1] >= 0.3

| Type | Field |
| --- | --- |
| `u64` | `nodeCount`. |
| Wrapped child[nodeCount] | Children, each in the order shown below. |
| `stringz` | Shared-animation scene name (`m_pStrRefAnimScene`), discarded by TypeScript. |

Each wrapped child is:

```text
byte[9] unknownPrefix     // skipped without inspection
i32 nodeType
CommonNode common
TypeSpecificPayload payload
byte unknownSuffix       // skipped without inspection
```

There is no reference string before the children in this branch: the equivalent shared-animation scene name follows them. TypeScript currently discards it instead of assigning `reference`. The nine-byte prefix and one-byte suffix remain unresolved. The TypeScript method for this layout is named `LoadConfused`.

## Geometry

Source: [NsGeometry.ts](src/Scene/NsGeometry.ts), [NsMaterial.ts](src/Scene/NsMaterial.ts), [NsWeightData.ts](src/Scene/NsWeightData.ts).

All fields below follow the common payload, in this order:

| Type | Field | Condition/details |
| --- | --- | --- |
| `f32` | `version[1]` | Inherited `CRenderable` layer version. |
| `u32` | `renderFlags` | Bitmask; see [render flags](#render-flags). |
| `f32` | `version[2]` | `CGeometry` layer version, passed to `CGeomData::Load` as `fVer`. |
| `u32` | `renderType` | Actually `CGeomData::m_eVertexType` (`EVertexType`); present only if `version[2] >= 0.20`, otherwise defaults to diffuse-map vertices (0). |
| `u32` | `materialCount` | Number of material records. |
| Material[materialCount] | `materials` | Layout below. |
| `u32` | `vertexCount` | Number of positions. |
| `vec3[vertexCount]` | `vertices` | Positions. |
| `u32` | `faceCount` | Number of triangles, not number of indices. |
| Triangle[faceCount] | `triangles` | Each triangle is three `u16` vertex indices (6 bytes). |
| `u32` | `normalCount` | Independent count. |
| `vec3[normalCount]` | `normals` | Normals. |
| `u32` | `uvCount` | Number of primary UVs. |
| `vec2[uvCount]` | `uv` | Primary UVs. |
| `vec2[uvCount]` | `uv2` | Only if `renderType == DiffuseLightmap` (1); **no separate count**. |
| `u32` | `tangentCount` | Independent count. |
| `vec3[tangentCount]` | `tangents` | Three-component tangents; no fourth handedness component is read. |
| `u32` | `weightDataCount` | Number of bone-weight records. |
| WeightData[weightDataCount] | `weightDatas` | Layout below. |
| `u32` | `animationCount` | Number of geometry animations. |
| GeometryAnimation[animationCount] | `animations` | See [animation blocks](#animation-blocks). |

The reader clears `AlphaBlend1`, `AlphaBlend2`, and `AlphaBlend3` in memory whenever `AlphaTest` is set. Consequently, parsed `renderFlags` may differ from the original stored bits.

### Material

| Type | Field | Condition/details |
| --- | --- | --- |
| `string[1024]` | `diffuse` | Texture reference. |
| `string[1024]` | `secondary` | Only if geometry `version[2] >= 0.20`. |
| `u32` | `faceStart` | First triangle for this material. |
| `u32` | `faceCount` | Number of triangles for this material. |

A material occupies 1032 bytes in the older branch or 2056 bytes in the newer branch. The sample importers convert its triangle range to an index range by multiplying `faceStart` and `faceCount` by three. The secondary reference is retained even for render types other than lightmap. No pixel data is embedded in this material record.

These records are subobjects: `faceStart` maps to `m_uiStart`/`uiStartIndex`, `faceCount` to `m_uiNumOfFace`, and `secondary` to the sub-map name. Its use depends on the vertex format (lightmap or normal map). An optional specular texture can be discovered externally under `specular/` using the diffuse filename, with a `.dds` fallback; there is no third serialized specular-name field. Texture loading may strip stored drive/directory components and resolve filenames against the resource work directory, so stored material paths should not be treated as absolute filesystem requirements.

### WeightData

| Type | Field |
| --- | --- |
| `stringz` | `bone`: referenced bone name. |
| `mat4` | `bindpose`: `m_pBaseInverse`, the base inverse/inverse bind matrix. |
| `u32` | `weightCount`. |
| Weight[weightCount] | Each entry is `u32 vertexId`, then `f32 weight` (8 bytes). |

Weights are grouped by bone, rather than stored as a fixed number of influences in each vertex. The `SWeight` fields are `m_uiID` and `m_fWeight`. CPU skinning forms `mVertOffset = baseInverse * BoneTM`, transforms source positions, multiplies by each weight, and accumulates into destination positions; normals use the same matrix with translation cleared. Thus `bindpose` must not be interpreted as a forward bind transform. The TypeScript parser does not normalize weights, enforce an influence limit, validate vertex IDs, or resolve the bone name. Duplicate vertex IDs within one record overwrite earlier values in its in-memory `Map`. Hardware skinning uses four influence slots per vertex; that runtime limit is not a serialized per-vertex influence count.

## Animation blocks

Sources: [NsGeometry.ts](src/Scene/NsGeometry.ts), [NsBone.ts](src/Scene/NsBone.ts), [animation data classes](src/Animation/).

The following shared blocks describe serialized bytes, even where the in-memory classes have default objects for absent tracks. TypeScript names `frame` and `frameCount` mean **tick** (`uiTick`/`m_uiTick`) and **total ticks** (`uiTotalTick`), not discrete rendered-frame counts. Playback advances by `u32(deltaMilliseconds * (4.8f * speed))`, corresponding to 4800 ticks per second at normal speed. Nonlooping playback clamps to total ticks; looping playback applies modulo when the tick exceeds the duration. No FPS field is stored. See [animation evaluation](#animation-evaluation) for interpolation rules.

### Transform track

| Type | Field |
| --- | --- |
| `u8` | `hasTransform`: zero means absent, **any nonzero byte** means present. TypeScript currently accepts only **1**. |
| `vec3` | Default/base position, if present. |
| `quat` | Default/base rotation, if present. |
| `vec3` | Default/base scale, if present. |
| `u32` | `positionCount`, if present. |
| PositionKey[positionCount] | Each: `u32 frame`, `vec3 value` (16 bytes). |
| `u32` | `rotationCount`, if present. |
| RotationKey[rotationCount] | Each: `u32 frame`, `quat value` (20 bytes). |
| `u32` | `scaleCount`, if present. |
| ScaleKey[scaleCount] | Each: `u32 frame`, `vec3 value` (16 bytes). |

Every row after the flag is conditional on the transform being present. In the current TypeScript implementation this requires `hasTransform == 1`; another nonzero value is incorrectly treated as absent and can misalign subsequent reads. A present transform block occupies `53 + 16*positionCount + 20*rotationCount + 16*scaleCount` bytes including the flag and counts.

### Opacity track

```text
u32 opacityCount
repeat opacityCount:
    u32 frame
    f32 opacity
```

Size: `4 + 8*opacityCount` bytes. The source peeks at the count, rewinds four bytes when nonzero, and rereads it; this is **one stored count**, not a presence flag followed by a second count. A zero count still consumes four bytes.

### Morph track (geometry only)

```text
u32 morphCount
repeat morphCount:
    u32 frame
    u32 vertexMorphCount
    repeat vertexMorphCount:
        u32 vertexId
        vec3 value
    u32 uvMorphCount
    repeat uvMorphCount:
        u32 vertexId
        vec2 value
```

The same peek-and-rewind count handling applies: there is only one `morphCount`. Each morph frame occupies `12 + 16*vertexMorphCount + 12*uvMorphCount` bytes; add four bytes for the outer count. There is no normal or tangent morph array in this reader.

### GeometryAnimation

```text
stringz name
u32 frameCount
TransformTrack transform
OpacityTrack opacity
MorphTrack morph
```

All three track headers occur for every geometry animation, even when their counts/flag indicate no payload. Geometry animations have no serialized `recycle` string in this implementation.

### Animation evaluation

Key times are ticks on the animation's timeline. For adjacent keys at ticks `t0` and `t1`, interpolation uses `a = (tick - t0) / (t1 - t0)`.

- Position and scale use linear interpolation, `v0 + (v1 - v0) * a`, when interpolation is enabled. With no applicable key they use the base position/scale; without a next key they hold the current value. Disabling interpolation selects the current key.
- Rotation uses quaternion spherical interpolation (SLERP), with the base rotation as fallback when no key applies. The on-disk quaternion order is `x, y, z, w`.
- The float track is **visibility**, represented as `opacities` by TypeScript. It interpolates linearly, holds the final applicable key, and falls back to `1.0` when no key applies. It drives a renderable's visibility value.
- Morph positions and UVs are **absolute replacement values**, not deltas to add to the base mesh. Values are written to the indexed position or primary UV slot. Adjacent morph records interpolate linearly; without a next key, the current values are copied directly.
- Morph interpolation pairs entries by their array positions and expects matching vertex IDs in adjacent records. Preserve entry ordering and matching lists when constructing compatible animation data; a dictionary alone does not express that constraint.
- Recycled bone animations are name aliases. Resolve the alias to its target animation before evaluating tracks; a reference-only record has no independent duration or track payload.

Transform, visibility, and morph evaluation are distinct operations. Loading their data does not itself implement playback, reference sharing, blending, or GPU skinning.

## Bone

Source: [NsBone.ts](src/Scene/NsBone.ts).

After the common payload:

```text
f32 version[1]
u32 animationCount
BoneAnimation animations[animationCount]
```

Each bone animation is:

| Type | Field | Condition |
| --- | --- | --- |
| `stringz` | `name` | Always. |
| `stringz` | `recycle` | Only if bone `version[1] >= 0.20`; otherwise defaults to empty. |
| `u32` | `frameCount` | Only if `recycle` is empty. |
| TransformTrack | Transform | Only if `recycle` is empty. |
| OpacityTrack | Opacity | Only if `recycle` is empty. |

A nonempty `recycle` string (`szRefAnimName`) ends that animation record immediately and defines an animation-name alias: `name -> recycle`. It refers to another animation name, not another file. TypeScript only retains the alias string. Bone animations do **not** contain the geometry morph-count word: morph tracks belong to geometry, and the base node morph loader consumes no bytes. A bone has no serialized child list in this implementation.

## BoneSystem

Source: [NsBoneSystem.ts](src/Scene/NsBoneSystem.ts).

After the common payload, read only `f32 version[1]`. There is no bone count, child list, or additional payload read by this class. Its name alone does not imply the group layout.

## ShapeNode

Source: [NsShapeNode.ts](src/Scene/NsShapeNode.ts).

| Type | Field |
| --- | --- |
| CommonNode | Common payload. |
| `f32` | `version[1]`; loading fails if `< 0.1`. |
| `u32` | `segmentCount`. |
| Segment[segmentCount] | Each: `vec3 start`, then `vec3 offset` (24 bytes). |

The two vectors are `SSegment::m_vCenter` and `m_vOffset`. Despite the name `center`, the endpoints are `m_vCenter` and `m_vCenter + m_vOffset`, so the TypeScript `start` mapping is appropriate. The second vector is stored as an **offset**, not an endpoint. The in-memory segment uses `end = start + offset` and does not retain a separate offset field.

## BoxNode

Source: [NsBoxNode.ts](src/Scene/NsBoxNode.ts).

| Type | Field |
| --- | --- |
| CommonNode | Common payload. |
| `f32` | `version[1]`; loading fails if `< 0.1`. |
| `f32` | `version[2]`; loading fails if `< 0.1`. |
| `vec3` | `center`. |
| `vec3` | `axisX`. |
| `vec3` | `axisY`. |
| `vec3` | `axisZ`. |
| `vec3` | `extents`. |

Payload after the common fields is 68 bytes. `version[1]` belongs to `CBasicGeomNode`; `version[2]` belongs to `CBoxNode`. The fields map to `SBox::m_vCenter`, `m_arrAxis[3]`, and `m_arrExtents[3]`. Extents are **half-sizes**: corners are `center +/- axisX*extentX +/- axisY*extentY +/- axisZ*extentZ`. After loading, transform decomposition and shape updating supply the runtime box representation.

## SphereNode

Source: [NsSphereNode.ts](src/Scene/NsSphereNode.ts).

| Type | Field |
| --- | --- |
| CommonNode | Common payload. |
| `f32` | `version[1]`; loading fails if `< 0.1`. |
| `f32` | `version[2]`; must be `>= 0.1`. TypeScript currently omits this check. |
| `vec3` | `SSphere::m_vCenter`, currently `unk.x/y/z` in TypeScript. |
| `f32` | `SSphere::m_fRadius`, currently `unk.w` in TypeScript. |

Payload after the common fields is 24 bytes. `version[1]` belongs to `CBasicGeomNode`, `version[2]` to `CSphereNode`. The final four floats are center plus radius. Transform decomposition supplies runtime position, rotation, and scale; TypeScript only retains the raw four sphere components in `unk`.

## LightNode

Source: [NsLightNode.ts](src/Scene/NsLightNode.ts).

After the common payload, read `f32 version[1]`. Loading fails if this value is `< 0.10`. The standard layout follows; the TypeScript parser instead selects its compatibility order when the version is `>= 0.3`. Both layouts consume another 92 bytes, for 96 bytes after the common payload including the version.

### Standard light layout

| Type | Field |
| --- | --- |
| `u32` | `lightType`. |
| `color` | `diffuse`. |
| `color` | `specular`. |
| `color` | `ambient`. |
| `vec3` | `direction`. |
| `f32` | `range`. |
| `f32` | `falloff`. |
| `f32` | `attenuation0`. |
| `f32` | `attenuation1`. |
| `f32` | `attenuation2`. |
| `f32` | `theta`. |
| `f32` | `phi`. |

### TypeScript alternate light layout: version[1] >= 0.3

| Type | Field |
| --- | --- |
| `f32` | `falloff`. |
| `color` | `diffuse`. |
| `f32` | `phi`. |
| `color` | `specular`. |
| `color` | `ambient`. |
| `u32` | `lightType`. |
| `f32` | `theta`. |
| `f32` | `attenuation2`. |
| `f32` | `range`. |
| `f32` | `attenuation1`. |
| `f32` | `attenuation0`. |
| `vec3` | `direction`. |

This alternate order is a TypeScript compatibility branch (`LoadConfused`), associated with Jungle and Station-2 in its comments. It is not established as a general version-0.3 light format: the standard order remains the baseline layout. The two layouts contain the same named fields and occupy the same size. Light initialization decomposes the matrix, reconstructs rotation from the stored direction relative to `(0,-1,0)`, and refreshes the transform; TypeScript does not perform that post-load work. Angular units and attenuation formulas remain outside this serialization reference.

## Enums

Sources: [Constants](src/Scene/Constants/).

### Node types

IDs are 32-bit component CRCs, read as signed `i32` here. Negative IDs describe the same bit patterns as their unsigned equivalents. They are identifiers, not consecutive enum ordinals.

| Name | Signed decimal ID |
| --- | ---: |
| `None` | 0 (declared, but not accepted by the node factory) |
| `SceneGroup` | 1652086138 |
| `LightNode` | -1008157086 |
| `Geometry` | 135305464 |
| `ShapeNode` | -1376896862 |
| `BoxNode` | 632156369 |
| `Bone` | 1832983249 |
| `BoneSystem` | 1584673599 |
| `SphereNode` | 1327244352 |

### Vertex formats (TypeScript render types)

The serialized enum selects geometry vertex data, not a render pass or blend mode. The TypeScript property is named `renderType`.

| Value | Name | Binary layout effect |
| ---: | --- | --- |
| 0 | `Diffuse` / `TYPE_DIFFUSEMAPVERTEX` | No secondary UV array. |
| 1 | `DiffuseLightmap` / `TYPE_LIGHTMAPVERTEX` | Adds `uvCount` secondary UV vectors. |
| 2 | `DiffuseBump` / `TYPE_NORMALMAPVERTEX` | No additional UV array read. |

### Render flags

These are the names declared by the repository, not a guarantee that every viewer implements each effect.

| Bit | Mask | Name |
| ---: | --- | --- |
| 0 | `0x00000001` | `LightDisable` |
| 1 | `0x00000002` | `AlphaBlend1` |
| 2 | `0x00000004` | `AlphaTest` |
| 3 | `0x00000008` | `NoCull` |
| 4 | `0x00000010` | `Billboard` |
| 5 | `0x00000020` | `AlphaBlend2` |
| 6 | `0x00000040` | `NoDepthWrite` |
| 7 | `0x00000080` | `Decal` |
| 8 | `0x00000100` | `NoPreRender` |
| 9 | `0x00000200` | `FogDisable` |
| 10 | `0x00000400` | `NoDepthTest` |
| 11 | `0x00000800` | `NoMipMap` |
| 12 | `0x00001000` | `VertexAnim` |
| 13 | `0x00002000` | `ShadowSurface` |
| 14 | `0x00004000` | `Glow` |
| 15 | `0x00008000` | `Haze` |
| 16 | `0x00010000` | `Refract` |
| 17 | `0x00020000` | `AlphaBlend3` |

### Light types

| Value | Name |
| ---: | --- |
| 0 | `Direct` / `LIGHT_DIRECTIONAL` |
| 1 | `Point` / `LIGHT_POINT` |
| 2 | `Spot` / `LIGHT_SPOT` |

## External resources and in-memory representation

`filePath` is supplied by `NsBinaryReader.name`; it is **not** an on-disk SCN field. Similarly, the `{ scene, assets }` wrapper returned by the sample server is an API representation, not a file header. `mapinfo/*.ini` and `xml/map.x7` are external map metadata, not embedded SCN sections.

Geometry texture references come from material strings. Groups recursively collect their children's references. `GetAssetNames()` deduplicates and sorts the collected strings **before** resolving extensions. For each reference it searches beside the SCN file in this order: `.dds`, `.png`, `.tga`, `.jpg`, `.bmp`, replacing any existing extension for the search. If none exists, it falls back to the original name. Returned entries are basenames, so directory components are removed; resolution can also make previously distinct names equal. The helper does not follow a group's `reference` file.

Animation keys are stored in JavaScript objects indexed by frame, so duplicate frame keys overwrite earlier entries. Morph entries are similarly indexed by vertex ID. `NsMorphKeyData.morphs` defaults to a `Map`, but the geometry loader replaces it with an object when morph data is present. Weight collections remain `Map` instances: ordinary `JSON.stringify` does not preserve their entries without a custom serialization strategy. The binary tables above retain the serialized counts and order, even where the resulting JavaScript representation does not.

## Encrypted scene buffers

Some newer SCN resources require preprocessing before reading the header. The encrypted-scene check is `size > 12 && buffer[1] == 0xCC`.

The buffer uses the first 12 bytes as its nonce/header region. Before decryption, replace the marker at byte 1 with `0x00` and copy those 12 bytes as the nonce. Decrypt bytes from offset 12 through the end with ChaCha20, using the format's fixed 32-byte key, a 96-bit nonce, and an initial block counter of **0**. The first 12 bytes remain in the buffer; they are not removed before parsing. There is no authentication tag consumed by this scheme.

The fixed key, as hexadecimal bytes, is:

```text
6e 65 76 65 72 67 6f 6e 6e 61 67 69 76 65 79 6f
75 75 70 75 77 75 69 6c 6f 76 65 75 77 75 73 21
```

This is an encrypted buffer representation, not another node payload. The TypeScript reader currently performs no marker detection or decryption, so it requires plaintext SCN data. The marker test is a format heuristic, not an integrity check.

## Compatibility and implementation limits

- The extended leading discriminator value, reserved header semantics, alternate-group wrapper bytes, and the alternate light layout's applicability remain unresolved.
- The plaintext parser consumes no checksum, compression, alignment padding, or footer. Encrypted buffers require the preprocessing above. This does not rule out other representations. The loader does not require its final offset to equal the file size, so trailing bytes may go unnoticed.
- Several runtime operations are outside the core TypeScript parser: rebuilding parent-name hierarchy, decomposing transforms, initializing light direction/rotation, updating shapes, sharing referenced scene animations, resolving bone animation aliases, and evaluating skinning/animation. Parsing their fields does not perform those operations.
- Additional scene component classes, including referenced scene groups and effect nodes, are outside this parser's eight-type factory. Their existence does not imply they share any of the payloads documented here.
- Unknown node IDs throw. Shape, box, sphere, and light version gates can return failure. Truncated scalar reads can throw buffer bounds errors; strings scan until a zero byte or a read fails. Counts and recursion depth have no explicit limits, and references, index ranges, finite floats, and array-count consistency are not comprehensively checked.
- The validator checks scene loading and vertex/normal count mismatch, but most other checks are placeholders. Successful parsing is not proof of correct rendering or complete format compatibility.
- Writer methods do not provide a usable full-format encoder: groups, bones, and lights return failure; geometry writes only the common payload; shape and sphere saves return success without writing their records. Several scalar writer methods write only a byte, vector/matrix methods repeatedly write at the same offset, and string writing does not mirror EUC-KR decoding. Use reader behavior as the authority for this reference, not `Save` output.
- No binary SCN asset corpus was used to validate these layouts. Preserve original bytes when investigating unknown fields or developing round-trip support.
