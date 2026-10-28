# SCN binary structure

This document describes the complete byte layout consumed by this repository's S4 League/Xero SCN reader. It is an implementation-derived reference, not an independently verified specification for every SCN variant. Fields named `unknown` below are consumed but discarded by the reader; their names here describe their position, not their meaning. Version conditions reproduce the code's comparisons, including its alternate Xero layouts.

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

This states storage order only. Coordinate handedness, units, and multiplication conventions are not established by the binary reader. The Three.js sample rearranges matrix elements when constructing its transform; do not assume that passing these floats directly to any graphics library produces the intended transform.

The current `readFixedString` returns an empty string if **no** zero byte occurs within the field, even if the field contains nonzero text. An empty `stringz` occupies one byte. Decimal versions below are stored as `f32`, not decimal text or integer hundredths; readers reproducing version dispatch must account for float representation.

## File header and node records

Source: [NsScene.ts](src/Scene/NsScene.ts).

The first four bytes are a version integer, not an ASCII magic signature.

### File version 1

| Absolute offset | Type | Field |
| --- | --- | --- |
| `0x00` | `u32` | `fileVersion == 1`. |
| `0x04` | Node record | Exactly one root node; no root count is stored. |

### File version other than 1

| Absolute offset | Type | Field |
| --- | --- | --- |
| `0x00` | `u32` | `fileVersion != 1`. |
| `0x04` | `u32` | Unknown header word 1, discarded. |
| `0x08` | `u32` | Unknown header word 2, discarded. |
| `0x0C` | `u32` | Root node count. |
| `0x10` | `u32` | Unknown header word 3, discarded. |
| `0x14` | `u32` | Unknown header word 4, discarded. |
| `0x18` | Node record[root count] | Root nodes. |

The implementation routes **every** value other than 1 through this header; that does not establish that all such versions are valid.

A normal node record is:

```text
i32 nodeType
CommonNode common
TypeSpecificPayload payload
```

`nodeType` selects the payload parser using the [node IDs](#node-types). Records have no general byte-length prefix. Unknown types throw; the reader cannot skip them. Root nodes and ordinary group children use the same record structure. Alternate group children add wrappers described below.

## Common node payload

Source: [NsSceneNode.ts](src/Scene/NsSceneNode.ts).

Every supported node begins with this payload, immediately after its type ID:

| Type | Field | Meaning |
| --- | --- | --- |
| `stringz` | `name` | Node name. |
| `stringz` | `parent` | Parent name string; not a numeric index. |
| `f32` | `version[0]` | Common/base node version; no dispatch uses it here. |
| `mat4` | `matrix` | Node transform. |

Common payload size is `encodedNameBytes + 1 + encodedParentBytes + 1 + 68`. Including the type ID adds four bytes. The on-disk parent string and a group's nested child list are distinct representations of hierarchy; the parser preserves both without validating consistency.

Versions are **per node/layer**: `fileVersion`, `version[0]`, `version[1]`, and `version[2]` are separate fields. Only read a layer version where its node layout specifies one.

## SceneGroup

Source: [NsSceneGroup.ts](src/Scene/NsSceneGroup.ts).

After the common payload, read `f32 version[1]`.

### Standard layout: version[1] < 0.3

| Type | Field | Condition |
| --- | --- | --- |
| `u32` | `nodeCount` | Always. |
| `stringz` | `reference` | Only when `version[1] >= 0.2`. |
| Node record[nodeCount] | `nodes` | Always; recursively parsed. |

The source comments suggest `reference` can identify a file supplying animations for some skirts, but do not establish its complete semantics. The parser retains the string without loading the referenced file.

### Alternate Xero layout: version[1] >= 0.3

| Type | Field |
| --- | --- |
| `u64` | `nodeCount`. |
| Wrapped child[nodeCount] | Children, each in the order shown below. |
| `stringz` | Unknown trailing string, discarded. |

Each wrapped child is:

```text
byte[9] unknownPrefix     // skipped without inspection
i32 nodeType
CommonNode common
TypeSpecificPayload payload
byte unknownSuffix       // skipped without inspection
```

There is no standard-layout `reference` read in this branch. The trailing string has a speculative global-animation comment in the source; its purpose is unconfirmed. The code calls this branch `LoadConfused` and labels it an import hack, so the nine-byte prefix and one-byte suffix must not be treated as understood metadata.

## Geometry

Source: [NsGeometry.ts](src/Scene/NsGeometry.ts), [NsMaterial.ts](src/Scene/NsMaterial.ts), [NsWeightData.ts](src/Scene/NsWeightData.ts).

All fields below follow the common payload, in this order:

| Type | Field | Condition/details |
| --- | --- | --- |
| `f32` | `version[1]` | Geometry layer version. |
| `u32` | `renderFlags` | Bitmask; see [render flags](#render-flags). |
| `f32` | `version[2]` | Material/render layer version. |
| `u32` | `renderType` | Present only if `version[2] >= 0.20`; otherwise defaults to `Diffuse` (0). |
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

### WeightData

| Type | Field |
| --- | --- |
| `stringz` | `bone`: referenced bone name. |
| `mat4` | `bindpose`. |
| `u32` | `weightCount`. |
| Weight[weightCount] | Each entry is `u32 vertexId`, then `f32 weight` (8 bytes). |

Weights are grouped by bone, rather than stored as a fixed number of influences in each vertex. The parser does not normalize weights, enforce an influence limit, validate vertex IDs, or resolve the bone name. Duplicate vertex IDs within one record overwrite earlier values in its in-memory `Map`.

## Animation blocks

Sources: [NsGeometry.ts](src/Scene/NsGeometry.ts), [NsBone.ts](src/Scene/NsBone.ts), [animation data classes](src/Animation/).

The following shared blocks describe serialized bytes, even where the in-memory classes have default objects for absent tracks. Fields named `frame` and `frameCount` follow source terminology; the reader does not establish time units, sample rate, interpolation rules, or whether a morph value is an absolute value or delta.

### Transform track

| Type | Field |
| --- | --- |
| `u8` | `hasTransform`: payload follows only when the byte equals **1**. |
| `vec3` | Default/base position, if present. |
| `quat` | Default/base rotation, if present. |
| `vec3` | Default/base scale, if present. |
| `u32` | `positionCount`, if present. |
| PositionKey[positionCount] | Each: `u32 frame`, `vec3 value` (16 bytes). |
| `u32` | `rotationCount`, if present. |
| RotationKey[rotationCount] | Each: `u32 frame`, `quat value` (20 bytes). |
| `u32` | `scaleCount`, if present. |
| ScaleKey[scaleCount] | Each: `u32 frame`, `vec3 value` (16 bytes). |

Every row after the flag is conditional on `hasTransform == 1`. A byte other than 1 consumes only that byte. A present transform block occupies `53 + 16*positionCount + 20*rotationCount + 16*scaleCount` bytes including the flag and counts.

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

A nonempty `recycle` string ends that animation record immediately. The name suggests reuse/reference behavior, but the loader only retains it and does not resolve the reference. Bone animations do **not** contain the geometry morph-count word. A bone has no serialized child list in this implementation.

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

The second vector is stored as an **offset**, not an endpoint. The in-memory segment uses `end = start + offset` and does not retain a separate offset field.

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

Payload after the common fields is 68 bytes. The axis vectors and extents describe the box in the source model; normalization and whether extents are half-sizes are not verified by the reader.

## SphereNode

Source: [NsSphereNode.ts](src/Scene/NsSphereNode.ts).

| Type | Field |
| --- | --- |
| CommonNode | Common payload. |
| `f32` | `version[1]`; loading fails if `< 0.1`. |
| `f32` | `version[2]`; no version check. |
| `vec4` | `unk`. |

Payload after the common fields is 24 bytes. The code does not establish the meaning of the four components; interpreting them as center plus radius would be an inference, not a documented reader behavior.

## LightNode

Source: [NsLightNode.ts](src/Scene/NsLightNode.ts).

After the common payload, read `f32 version[1]`. Loading fails if this value is `< 0.10`. It selects one of the following layouts. Both layouts consume another 92 bytes, for 96 bytes after the common payload including the version.

### Standard layout: version[1] < 0.3

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

### Alternate Xero layout: version[1] >= 0.3

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

The source calls the alternate branch `LoadConfused` and comments that it is used for Jungle and Station-2. It reorders the same named fields; there are no additional bytes read in that branch. Angular units and attenuation formulas are not defined by this parser.

## Enums

Sources: [Constants](src/Scene/Constants/).

### Node types

IDs are serialized as signed `i32`. They are identifiers, not consecutive enum ordinals.

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

### Render types

| Value | Name | Binary layout effect |
| ---: | --- | --- |
| 0 | `Diffuse` | No secondary UV array. |
| 1 | `DiffuseLightmap` | Adds `uvCount` secondary UV vectors. |
| 2 | `DiffuseBump` | No additional UV array read. |

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
| 0 | `Direct` |
| 1 | `Point` |
| 2 | `Spot` |

## External resources and in-memory representation

`filePath` is supplied by `NsBinaryReader.name`; it is **not** an on-disk SCN field. Similarly, the `{ scene, assets }` wrapper returned by the sample server is an API representation, not a file header. `mapinfo/*.ini` and `xml/map.x7` are external map metadata, not embedded SCN sections.

Geometry texture references come from material strings. Groups recursively collect their children's references. `GetAssetNames()` deduplicates and sorts the collected strings **before** resolving extensions. For each reference it searches beside the SCN file in this order: `.dds`, `.png`, `.tga`, `.jpg`, `.bmp`, replacing any existing extension for the search. If none exists, it falls back to the original name. Returned entries are basenames, so directory components are removed; resolution can also make previously distinct names equal. The helper does not follow a group's `reference` file.

Animation keys are stored in JavaScript objects indexed by frame, so duplicate frame keys overwrite earlier entries. Morph entries are similarly indexed by vertex ID. `NsMorphKeyData.morphs` defaults to a `Map`, but the geometry loader replaces it with an object when morph data is present. Weight collections remain `Map` instances: ordinary `JSON.stringify` does not preserve their entries without a custom serialization strategy. The binary tables above retain the serialized counts and order, even where the resulting JavaScript representation does not.

## Compatibility and implementation limits

- This reference covers all reads performed by the current SCN parser. Unknown header words, alternate-group wrapper bytes and trailing string, sphere semantics, and unimplemented variants remain unresolved.
- There is no checksum, compression, alignment padding, or footer consumed by these readers. This describes implementation behavior; it does not rule out such data in other variants. The loader does not require its final offset to equal the file size, so trailing bytes may go unnoticed.
- Unknown node IDs throw. Shape, box, sphere, and light version gates can return failure. Truncated scalar reads can throw buffer bounds errors; strings scan until a zero byte or a read fails. Counts and recursion depth have no explicit limits, and references, index ranges, finite floats, and array-count consistency are not comprehensively checked.
- The validator checks scene loading and vertex/normal count mismatch, but most other checks are placeholders. Successful parsing is not proof of correct rendering or complete format compatibility.
- Writer methods do not provide a usable full-format encoder: groups, bones, and lights return failure; geometry writes only the common payload; shape and sphere saves return success without writing their records. Several scalar writer methods write only a byte, vector/matrix methods repeatedly write at the same offset, and string writing does not mirror EUC-KR decoding. Use reader behavior as the authority for this reference, not `Save` output.
- This document was checked against the TypeScript source, without validation against a corpus of binary SCN assets. Preserve original bytes when investigating unknown fields or developing round-trip support.
