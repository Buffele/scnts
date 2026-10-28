import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NsScene } from '../src/Scene/NsScene';
import { NsNodeType as Type } from '../src/Scene/Constants/NsNodeType';
import { NsSceneGroup } from '../src/Scene/NsSceneGroup';
import { NsSphereNode } from '../src/Scene/NsSphereNode';
import { NsGeometry } from '../src/Scene/NsGeometry';
import { NsBone } from '../src/Scene/NsBone';
import { NsLightNode } from '../src/Scene/NsLightNode';
import { NsBoxNode } from '../src/Scene/NsBoxNode';
import { NsShapeNode } from '../src/Scene/NsShapeNode';
import { NsBinaryReader } from '../src/IO/NsBinaryReader';
import { NsBinaryWriter } from '../src/IO/NsBinaryWriter';
import { SeekOrigin } from '../src/IO/SeekOrigin';
import { DecodeSceneBuffer } from '../src/IO/NsAssetCrypt';

// Fixtures use Buffer primitives, independently of the production writer.
const cat = (...parts: Buffer[]) => Buffer.concat(parts);
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const f32 = (n: number) => { const b = Buffer.alloc(4); b.writeFloatLE(n); return b; };
const floats = (...ns: number[]) => cat(...ns.map(f32));
const str = (s: string) => cat(Buffer.from(s), Buffer.from([0]));
const fixed = (s: string) => { const b = Buffer.alloc(1024); b.write(s); return b; };
const matrix = floats(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 11, 22, 33, 1);
const common = (name = 'node', parent = '') => cat(str(name), str(parent), f32(0.1), matrix);
const node = (type: Type, payload: Buffer, name = 'node', parent = '') => cat(u32(type), common(name, parent), payload);
const sphere = (version = 0.1) => cat(f32(0.1), f32(version), floats(2, 3, 4, 5));
const boneSystem = () => node(Type.BoneSystem, f32(0.1));
const extended = (...nodes: Buffer[]) => cat(u32(0), u32(5), u32(42), u32(nodes.length), u32(7), u32(9), ...nodes);
const transform = () => cat(Buffer.from([2]), floats(1, 2, 3, 0, 0, 0, 1, 1, 1, 1),
    u32(1), u32(120), floats(4, 5, 6), u32(1), u32(120), floats(0, 0, 0, 1),
    u32(1), u32(120), floats(2, 2, 2));

function load(bytes: Buffer) {
    const reader = new NsBinaryReader(bytes);
    const scene = new NsScene();
    assert.equal(scene.Load(reader), true);
    assert.equal(reader.offset, bytes.length, 'fixture must be consumed exactly');
    return scene;
}

test('legacy header, sphere fields, and translation matrix', () => {
    const scene = load(cat(u32(1), node(Type.SphereNode, sphere())));
    assert.equal(scene.header, null);
    const n = scene.nodes[0] as NsSphereNode;
    assert.deepEqual([n.center.x, n.center.y, n.center.z, n.radius], [2, 3, 4, 5]);
    assert.deepEqual([n.matrix.m30, n.matrix.m31, n.matrix.m32], [11, 22, 33]);
    assert.equal(n.unk.w, 5, 'legacy property remains usable');
});

test('extended header retains metadata and all root records', () => {
    const scene = load(extended(boneSystem(), node(Type.SphereNode, sphere())));
    assert.deepEqual(scene.header, { maxVersion: 5, sceneVersion: 42, nodeCount: 2, reserved1: 7, reserved2: 9 });
    assert.equal(scene.nodes.length, 2);
});

test('sphere rejects an unsupported sphere-layer version', () => {
    assert.equal(NsScene.LoadFromBuffer(cat(u32(1), node(Type.SphereNode, sphere(0.05)))), null);
});

test('standard groups retain animation reference and parent names', () => {
    const child = node(Type.BoneSystem, f32(0.1), 'child', 'root');
    const group = load(cat(u32(1), node(Type.SceneGroup, cat(f32(0.2), u32(1), str('shared.scn'), child), 'root'))).nodes[0] as NsSceneGroup;
    assert.equal(group.reference, 'shared.scn');
    assert.equal(group.nodes[0].parent, 'root');
});

test('new groups retain trailing animation reference and wrapper alignment', () => {
    const count = Buffer.alloc(8); count.writeBigUInt64LE(BigInt(1));
    const payload = cat(f32(0.3), count, Buffer.alloc(9, 0xaa), boneSystem(), Buffer.from([0xbb]), str('shared.scn'));
    const scene = load(extended(node(Type.SceneGroup, payload), boneSystem()));
    assert.equal((scene.nodes[0] as NsSceneGroup).reference, 'shared.scn');
    assert.equal((scene.nodes[0] as NsSceneGroup).nodes.length, 1);
});

test('bone animation aliases and any nonzero transform flag preserve following records', () => {
    const anim = cat(str('base'), str(''), u32(4800), transform(), u32(1), u32(120), f32(0.5));
    const alias = cat(str('run'), str('base'));
    const scene = load(extended(node(Type.Bone, cat(f32(0.2), u32(2), anim, alias)), boneSystem()));
    const bone = scene.nodes[0] as NsBone;
    assert.equal(bone.animations[0].frameCount, 4800);
    assert.equal(bone.animations[0].transformKeyData.positions[120].z, 6);
    assert.equal(bone.animations[0].floatKeyData.opacities[120], 0.5);
    assert.equal(bone.animations[1].recycle, 'base');
});

function geometry(version: number, format: number) {
    const materials = cat(u32(1), fixed('diffuse.dds'), ...(version >= 0.2 ? [fixed('secondary.dds')] : []), u32(0), u32(1));
    const mesh = cat(u32(1), floats(1, 2, 3), u32(1), Buffer.from([0, 0, 0, 0, 0, 0]),
        u32(1), floats(0, 1, 0), u32(1), floats(0.25, 0.5), ...(format === 1 ? [floats(0.5, 0.75)] : []),
        u32(1), floats(1, 0, 0));
    const weights = cat(u32(1), str('bone'), matrix, u32(1), u32(0), f32(0.75));
    const morph = cat(u32(1), u32(120), u32(1), u32(0), floats(8, 9, 10), u32(1), u32(0), floats(0.5, 0.25));
    const anim = cat(u32(1), str('move'), u32(4800), transform(), u32(0), morph);
    return cat(f32(0.1), u32(0x26), f32(version), ...(version >= 0.2 ? [u32(format)] : []), materials, mesh, weights, anim);
}

for (const [version, format] of [[0.1, 0], [0.2, 0], [0.2, 1], [0.2, 2]]) {
    test(`geometry ${version}/${format}: materials, arrays, weights, and morph alignment`, () => {
        const g = load(extended(node(Type.Geometry, geometry(version, format)), boneSystem())).nodes[0] as NsGeometry;
        assert.equal(g.renderFlags, 4, 'alpha test clears both alpha blend flags');
        assert.equal(g.materials[0].secondary, version >= 0.2 ? 'secondary.dds' : '');
        assert.equal(g.uv2.length, format === 1 ? 1 : 0);
        assert.equal(g.weightDatas[0].weights.get(0), 0.75);
        assert.equal(JSON.parse(JSON.stringify(g.weightDatas[0])).weights['0'], 0.75);
        assert.equal(g.animations[0].morphKeyData.morphs[120].vertices[0].z, 10);
        assert.equal(g.animations[0].transformKeyData.positions[120].x, 4);
    });
}

const lightStandard = () => cat(u32(2), floats(1, 2, 3, 4), floats(5, 6, 7, 8), floats(9, 10, 11, 12),
    floats(0, -1, 0), floats(100, 2, 3, 4, 5, 6, 7));
test('standard light ordering applies even at version 0.3', () => {
    const light = load(extended(node(Type.LightNode, cat(f32(0.3), lightStandard())), boneSystem())).nodes[0] as NsLightNode;
    assert.equal(light.lightType, 2);
    assert.equal(light.range, 100);
    assert.equal(light.phi, 7);
});
test('alternate light ordering is an explicit option', () => {
    const payload = cat(f32(0.3), f32(2), floats(1, 2, 3, 4), f32(7), floats(5, 6, 7, 8),
        floats(9, 10, 11, 12), u32(2), floats(6, 5, 100, 4, 3), floats(0, -1, 0));
    const scene = NsScene.LoadFromBuffer(extended(node(Type.LightNode, payload)), { lightLayout: 'alternate' })!;
    const light = scene.nodes[0] as NsLightNode;
    assert.equal(light.lightType, 2);
    assert.equal(light.range, 100);
    assert.equal(light.phi, 7);
});

test('shape segments and boxes parse and serialize without losing components', () => {
    const shapeBytes = cat(common(), f32(0.1), u32(1), floats(1, 2, 3, 4, 5, 6));
    const shape = new NsShapeNode();
    assert.equal(shape.Load(new NsBinaryReader(shapeBytes)), true);
    assert.equal(shape.segments[0].end.z, 9);
    const writer = new NsBinaryWriter();
    assert.equal(shape.Save(writer), true);
    assert.deepEqual(writer.handle, shapeBytes);
    const boxBytes = cat(common(), f32(0.1), f32(0.1), floats(1, 2, 3, 1, 0, 0, 0, 1, 0, 0, 0, 1, 4, 5, 6));
    const box = new NsBoxNode();
    assert.equal(box.Load(new NsBinaryReader(boxBytes)), true);
    const boxWriter = new NsBinaryWriter();
    assert.equal(box.Save(boxWriter), true);
    assert.deepEqual(boxWriter.handle, boxBytes);
});

test('reader rejects truncation and out-of-range seeks without moving', () => {
    const reader = new NsBinaryReader(Buffer.from([1, 2]));
    assert.throws(() => reader.readUInt32(), /Truncated/);
    assert.equal(reader.offset, 0);
    assert.throws(() => reader.seek(3, SeekOrigin.Begin), /outside/);
    assert.equal(reader.offset, 0);
    assert.throws(() => reader.readString(), /Truncated/);
});
test('fixed strings decode all bytes without a terminator; Korean strings round trip', () => {
    assert.equal(new NsBinaryReader(Buffer.from('full')).readFixedString(4), 'full');
    const writer = new NsBinaryWriter();
    writer.writeString('한글');
    assert.equal(writer.handle.toString('hex'), 'c7d1b1db00');
    assert.equal(new NsBinaryReader(writer.handle).readString(), '한글');
    assert.throws(() => writer.writeFixedString('한글', 3), /exceeds/);
});
test('writer emits full little-endian numbers, distinct vector components, and seek overwrites', () => {
    const writer = new NsBinaryWriter();
    writer.writeInt16(-1234); writer.writeUInt16(50000); writer.writeInt32(-12345678); writer.writeUInt32(0xfedcba98);
    writer.writeMatrix4(new NsBinaryReader(matrix).readMatrix4());
    const reader = new NsBinaryReader(writer.handle);
    assert.equal(reader.readInt16(), -1234); assert.equal(reader.readUInt16(), 50000);
    assert.equal(reader.readInt32(), -12345678); assert.equal(reader.readUInt32(), 0xfedcba98);
    assert.deepEqual(reader.read(64), matrix);
    const length = writer.handle.length;
    writer.seek(0, SeekOrigin.Begin); writer.writeUInt16(0xabcd);
    assert.equal(writer.handle.length, length);
    assert.equal(writer.handle.readUInt16LE(0), 0xabcd);
});
test('reload resets versions, extended metadata, references, and secondary UVs', () => {
    const scene = new NsScene();
    assert.equal(scene.Load(new NsBinaryReader(extended(boneSystem()))), true);
    assert.equal(scene.Load(new NsBinaryReader(cat(u32(1), boneSystem()))), true);
    assert.equal(scene.header, null);
    const g = new NsGeometry();
    assert.equal(g.Load(new NsBinaryReader(cat(common(), geometry(0.2, 1)))), true);
    assert.equal(g.Load(new NsBinaryReader(cat(common(), geometry(0.1, 0)))), true);
    assert.equal(g.version.length, 3);
    assert.equal(g.uv2.length, 0);
    const group = new NsSceneGroup();
    group.reference = 'stale.scn';
    assert.equal(group.Load(new NsBinaryReader(cat(common(), f32(0.1), u32(0)))), true);
    assert.equal(group.reference, '');
});
test('unsupported geometry saving reports failure without partial output', () => {
    const writer = new NsBinaryWriter();
    assert.equal(new NsGeometry().Save(writer), false);
    assert.equal(writer.handle.length, 0);
});

test('sphere payload writer preserves center, radius, and legacy access', () => {
    const bytes = cat(common(), sphere());
    const n = new NsSphereNode();
    assert.equal(n.Load(new NsBinaryReader(bytes)), true);
    const writer = new NsBinaryWriter();
    assert.equal(n.Save(writer), true);
    assert.deepEqual(writer.handle, bytes);
    n.radius = 12;
    n.center = { x: 7, y: 8, z: 9 };
    assert.deepEqual([n.unk.x, n.unk.y, n.unk.z, n.unk.w], [7, 8, 9, 12]);
});

test('resolved asset basenames remain unique and sorted', () => {
    const scene = new NsScene();
    const g = new NsGeometry();
    g.materials = [
        { diffuse: 'one/z.dds', secondary: 'two/z.dds', faceStart: 0, faceCount: 0 },
        { diffuse: 'a.dds', secondary: '', faceStart: 0, faceCount: 0 },
    ];
    const group = new NsSceneGroup();
    group.nodes = [g];
    scene.nodes = [group];
    assert.deepEqual(scene.GetAssetNames(), ['a.dds', 'z.dds']);
});

test('every truncated prefix of a valid scene fails instead of accepting a partial record', () => {
    const bytes = extended(node(Type.SphereNode, sphere()));
    for (let end = 0; end < bytes.length; end++) {
        assert.throws(() => NsScene.LoadFromBuffer(bytes.subarray(0, end)), RangeError);
    }
});

// Independent ChaCha20 block implementation for encrypted fixture generation.
function encryptFixture(plain: Buffer): Buffer {
    const result = Buffer.from(plain);
    const key = Buffer.from('nevergonnagiveyouupuwuiloveuwus!');
    assert.equal(key.length, 32);
    for (let offset = 12, counter = 0; offset < plain.length; offset += 64, counter++) {
        const state = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];
        for (let i = 0; i < 8; i++) state.push(key.readUInt32LE(i * 4));
        state.push(counter, plain.readUInt32LE(0), plain.readUInt32LE(4), plain.readUInt32LE(8));
        const x = state.slice();
        const rotate = (v: number, n: number) => (v << n) | (v >>> (32 - n));
        const q = (a: number, b: number, c: number, d: number) => {
            x[a] = (x[a] + x[b]) >>> 0; x[d] = rotate(x[d] ^ x[a], 16);
            x[c] = (x[c] + x[d]) >>> 0; x[b] = rotate(x[b] ^ x[c], 12);
            x[a] = (x[a] + x[b]) >>> 0; x[d] = rotate(x[d] ^ x[a], 8);
            x[c] = (x[c] + x[d]) >>> 0; x[b] = rotate(x[b] ^ x[c], 7);
        };
        for (let round = 0; round < 10; round++) {
            q(0, 4, 8, 12); q(1, 5, 9, 13); q(2, 6, 10, 14); q(3, 7, 11, 15);
            q(0, 5, 10, 15); q(1, 6, 11, 12); q(2, 7, 8, 13); q(3, 4, 9, 14);
        }
        const block = Buffer.alloc(64);
        for (let i = 0; i < 16; i++) block.writeUInt32LE((x[i] + state[i]) >>> 0, i * 4);
        for (let i = 0; i < 64 && offset + i < plain.length; i++) result[offset + i] ^= block[i];
    }
    result[1] = 0xcc;
    return result;
}
test('encrypted scenes decrypt across blocks without changing caller data', () => {
    const plain = extended(node(Type.SphereNode, sphere()), boneSystem());
    const encrypted = encryptFixture(plain);
    const original = Buffer.from(encrypted);
    assert.deepEqual(DecodeSceneBuffer(encrypted), plain);
    assert.deepEqual(encrypted, original);
    assert.equal(NsScene.LoadFromBuffer(encrypted)!.nodes.length, 2);
});
