import { NsSceneNode } from './NsSceneNode';
import { NsRenderFlags } from './Constants/NsRenderFlags';
import { NsRenderType } from './Constants/NsRenderType';
import { NsMaterial } from './NsMaterial';
import { NsWeightData } from './NsWeightData';
import { NsAnimation } from '../Animation/NsAnimation';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsTransformKeyData } from '../Animation/NsTransformKeyData';
import { SeekOrigin } from '../IO/SeekOrigin';
import { NsFloatKeyData } from '../Animation/NsFloatKeyData';
import { NsMorphKey } from '../Animation/NsMorphKey';
import { NsMorphKeyData } from '../Animation/NsMorphKeyData';
import { NsNodeType } from './Constants/NsNodeType';
import { NsVector2, NsVector3 } from "../Common/NsMath";

export class NsGeometry extends NsSceneNode
{
	renderFlags: NsRenderFlags = NsRenderFlags.None;
	renderType: NsRenderType = NsRenderType.Diffuse;
	materials: NsMaterial[] = [];
	vertices: NsVector3[] = [];
	triangles: number[] = [];
	normals: NsVector3[] = [];
	uv: NsVector2[] = [];
	uv2: NsVector2[] = [];
	tangents: NsVector3[] = [];
	weightDatas: NsWeightData[] = [];
	animations: NsAnimation[] = [];

	constructor(name: string = '', parent: string = '')
	{
		super(name, parent);
		this.nodeType = NsNodeType.Geometry;
	}

	Load(reader: NsBinaryReader): boolean
	{
		if (!super.Load(reader)) {
			return false;
		}

		this.version[1] = reader.readSingle();
		this.renderFlags = reader.readUInt32();
		if (this.renderFlags & NsRenderFlags.AlphaTest) {
			this.renderFlags &= ~(NsRenderFlags.AlphaBlend1 | NsRenderFlags.AlphaBlend2 | NsRenderFlags.AlphaBlend3);
		}

		this.version[2] = reader.readSingle();
		this.renderType = NsRenderType.Diffuse;
		if (this.version[2] >= 0.20) {
			this.renderType = reader.readUInt32();
		}

		this.materials = [];
		const materialCount = reader.readUInt32();
		for (let i = 0; i < materialCount; ++i)
		{
			const material = new NsMaterial();
			material.diffuse = reader.readFixedString(1024);
			if (this.version[2] >= 0.20) {
				material.secondary = reader.readFixedString(1024);
			}

			material.faceStart = reader.readUInt32();
			material.faceCount = reader.readUInt32();
			this.materials.push(material);
		}

		this.vertices = []
		const vertexCount = reader.readUInt32();
		for (let i = 0; i < vertexCount; ++i) {
			this.vertices.push(reader.readVector3());
		}

		this.triangles = []
		const faceCount = reader.readUInt32();
		for (let i = 0; i < faceCount; ++i)
		{
			this.triangles.push(reader.readUInt16());
			this.triangles.push(reader.readUInt16());
			this.triangles.push(reader.readUInt16());
		}

		this.normals = [];
		const normalCount = reader.readUInt32();
		for (let i = 0; i < normalCount; ++i) {
			this.normals.push(reader.readVector3());
		}

		this.uv = [];
		const uvCount = reader.readUInt32();
		for (let i = 0; i < uvCount; ++i) {
			this.uv.push(reader.readVector2());
		}

		if (this.renderType == NsRenderType.DiffuseLightmap)
		{
			this.uv2 = [];
			for (let i = 0; i < uvCount; ++i) {
				this.uv2.push(reader.readVector2());
			}
		}

		this.tangents = [];
		const tangentCount = reader.readUInt32();
		for (let i = 0; i < tangentCount; ++i) {
			this.tangents.push(reader.readVector3());
		}

		this.weightDatas = [];
		const weightDataCount = reader.readUInt32();
		for (let i = 0; i < weightDataCount; ++i)
		{
			const bone = reader.readString();
			const bindpose = reader.readMatrix4();

			const weights = new Map<number, number>();
			const weightCount = reader.readUInt32();
			for (let n = 0; n < weightCount; ++n)
			{
				let vertexId = reader.readUInt32();
				let weight = reader.readSingle();
				weights.set(vertexId, weight);
			}

			const weightData = new NsWeightData();
			weightData.bone = bone;
			weightData.bindpose = bindpose;
			weightData.weights = weights;
			this.weightDatas.push(weightData);
		}

		this.animations = [];
		const animationCount = reader.readUInt32();
		for (let i = 0; i < animationCount; ++i)
		{
			const anim = new NsAnimation(reader.readString());
			anim.frameCount = reader.readUInt32();

			if (reader.readByte() == 1)
			{
				const position = reader.readVector3();
				const rotation = reader.readQuaternion();
				const scale = reader.readVector3();

				const positions: any = {};
				const positionCount = reader.readUInt32();
				for (let n = 0; n < positionCount; ++n)
				{
					const frame = reader.readUInt32();
					const value = reader.readVector3();
					positions[frame] = {
						x: value.x,
						y: value.y,
						z: value.z
					};
				}

				const rotations: any = {};
				const rotationCount = reader.readUInt32();
				for (let n = 0; n < rotationCount; ++n)
				{
					const frame = reader.readUInt32();
					const value = reader.readQuaternion();
					rotations[frame] = {
						x: value.x,
						y: value.y,
						z: value.z,
						w: value.w
					};
				}

				const scales: any = {};
				const scaleCount = reader.readUInt32();
				for (let n = 0; n < scaleCount; ++n)
				{
					const frame = reader.readUInt32();
					const value = reader.readVector3();
					scales[frame] = {
						x: value.x,
						y: value.y,
						z: value.z
					};
				}

				anim.transformKeyData = new NsTransformKeyData();
				anim.transformKeyData.position = position;
				anim.transformKeyData.positions = positions;
				anim.transformKeyData.rotation = rotation;
				anim.transformKeyData.rotations = rotations;
				anim.transformKeyData.scale = scale;
				anim.transformKeyData.scales = scales;
			}

			if (reader.readUInt32() > 0)
			{
				reader.seek(-4, SeekOrigin.Current);

				const opacities: any = {};
				const opacityCount = reader.readUInt32();
				for (let n = 0; n < opacityCount; ++n)
				{
					const frame = reader.readUInt32();
					opacities[frame] = reader.readSingle();
				}

				anim.floatKeyData = new NsFloatKeyData();
				anim.floatKeyData.opacities = opacities;
			}

			if (reader.readUInt32() > 0)
			{
				reader.seek(-4, SeekOrigin.Current);

				const morphs: any = {};
				const morphCount = reader.readUInt32();
				for (let n = 0; n < morphCount; ++n)
				{
					const frame = reader.readUInt32();

					const vertexMorphs: any = {};
					const vertexMorphCount = reader.readUInt32();
					for (let y = 0; y < vertexMorphCount; ++y)
					{
						const vertex = reader.readUInt32();
						vertexMorphs[vertex] = reader.readVector3();
					}

					const uvMorphs: any = {};
					const uvMorphCount = reader.readUInt32();
					for (let y = 0; y < uvMorphCount; ++y)
					{
						const vertex = reader.readUInt32();
						uvMorphs[vertex] = reader.readVector2();
					}

					const morphKey = new NsMorphKey();
					morphKey.vertices = vertexMorphs;
					morphKey.uv = uvMorphs;

					morphs[frame] = morphKey;
				}

				anim.morphKeyData = new NsMorphKeyData();
				anim.morphKeyData.morphs = morphs;
			}

			this.animations.push(anim);
		}

		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		return super.Save(writer);
	}

	GetAssetNames(): string[]
	{
		const results: string[] = [];
		for (const material of this.materials) {
			if (material.diffuse.length > 0) {
				results.push(material.diffuse);
			}

			if (material.secondary.length > 0) {
				results.push(material.secondary);
			}
		}

		return results;
	}
}