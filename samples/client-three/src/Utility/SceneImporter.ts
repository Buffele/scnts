import * as THREE from "three";
import { NsScene } from "@scnts/Scene/NsScene";
import { NsSceneNode } from "@scnts/Scene/NsSceneNode";
import { NsNodeType } from "@scnts/Scene/Constants/NsNodeType";
import { NsSceneGroup } from "@scnts/Scene/NsSceneGroup";
import { NsGeometry } from "@scnts/Scene/NsGeometry";
import { NsBoxNode } from "@scnts/Scene/NsBoxNode";
import { NsBone } from "@scnts/Scene/NsBone";
import { NsBoneSystem } from "@scnts/Scene/NsBoneSystem";
import { NsRenderFlags } from "@scnts/Scene/Constants/NsRenderFlags";
import { TextureLoader } from "./TextureLoader";
import { FragmentShader, VertexShader } from "../Renderer/Shaders";
import { BlendingSrcFactor } from "three/src/constants";
import { Animator } from "../Scene/Animator";
import { Renderer } from "../Renderer/Renderer";

export class SceneImporter
{
	scene: THREE.Scene;
	refScene: NsScene;

	currentGroup: THREE.Object3D;
	topObjects: THREE.Object3D[] = [];
	animators: Animator[] = [];

	firstSceneAnim: string = "";

	objectToNode: Map<THREE.Object3D, NsSceneNode> = new Map();
	nameToNode: Map<string, NsSceneNode> = new Map();
	nameToObject: Map<string, THREE.Object3D> = new Map();

	constructor(scene: THREE.Scene, refScene: NsScene)
	{
		this.scene = scene;
		//this.scene.matrixAutoUpdate = false;
		//this.scene.matrixWorldAutoUpdate = false;
		this.refScene = refScene;
		this.currentGroup = this.scene;
	}

	async run()
	{
		for (const node of this.refScene.nodes) {
			await this.importNode(node);
		}
	}

	async importNode(node: NsSceneNode)
	{
		if (node.nodeType == NsNodeType.SceneGroup) {
			await this.importSceneGroup(<NsSceneGroup> node);
		}
		else if (node.nodeType == NsNodeType.Geometry) {
			await this.importGeometry(<NsGeometry> node);
		}
		else if (node.nodeType == NsNodeType.BoxNode) {
			await this.importBoxNode(<NsBoxNode> node);
		}
		else if (node.nodeType == NsNodeType.Bone) {
			await this.importBone(<NsBone> node);
		}
		else if (node.nodeType == NsNodeType.BoneSystem) {
			await this.importBoneSystem(<NsBoneSystem> node);
		}
	}

	async importSceneGroup(group: NsSceneGroup)
	{
		const object = new THREE.Object3D();
		this.transformObject(object, group);
		this.topObjects.push(object);

		this.currentGroup = object;
		for (const node of group.nodes) {
			await this.importNode(node);
		}

		if (this.firstSceneAnim != "")
		{
			const animator = new Animator(object, group);
			animator.Play(this.firstSceneAnim, 0.0);
			this.animators.push(animator);

			// @ts-ignore
			object.animator = animator;
		}

		this.currentGroup = this.scene;
	}

	async importGeometry(node: NsGeometry)
	{
		let vertices = [];
		for (let i = 0; i < node.vertices.length; ++i)
		{
			let value = node.vertices[i];
			vertices.push(value.x * 0.01);
			vertices.push(value.z * 0.01);
			vertices.push(value.y * 0.01);
		}

		let normals = [];
		for (let i = 0; i < node.normals.length; ++i)
		{
			const value = node.normals[i];
			normals.push(value.x);
			normals.push(value.z);
			normals.push(value.y);
		}

		let indices = [];
		for (let i = 0; i < node.triangles.length; i += 3)
		{
			indices.push(node.triangles[i]);
			indices.push(node.triangles[i + 2]);
			indices.push(node.triangles[i + 1]);
		}

		let uvs = [];
		for (let i = 0; i < node.uv.length; ++i)
		{
			let uv = node.uv[i];
			uvs.push(uv.x);
			uvs.push(uv.y);
		}

		let uvs2 = [];
		for (let i = 0; i < node.uv2.length; ++i)
		{
			let uv = node.uv2[i];
			uvs2.push(uv.x);
			uvs2.push(uv.y);
		}

		const name = node.name;
		const geometry = new THREE.BufferGeometry();
		geometry.attributes.position = new THREE.BufferAttribute(new Float32Array(vertices), 3);
		geometry.attributes.normal = new THREE.BufferAttribute(new Float32Array(normals), 3);
		geometry.attributes.uv = new THREE.BufferAttribute(new Float32Array(uvs), 2);
		geometry.attributes.uv2 = new THREE.BufferAttribute(new Float32Array(uvs2), 2);
		geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));

		let materials = [];
		{
			for (const mat of node.materials)
			{
				const material = new THREE.ShaderMaterial({
					vertexShader: VertexShader,
					fragmentShader: FragmentShader,
					defines: {},
					uniforms: {
						opacity: {
							value: 1.0
						}
					}
				});

				if (node.renderFlags & NsRenderFlags.AlphaTest) {
					material.alphaTest = 0.5;
					material.defines["_ALPHA_TEST"] = true;
				}
				else if (node.renderFlags & NsRenderFlags.AlphaBlend1) {
					material.blending = THREE.CustomBlending;
					material.blendSrc = THREE.SrcAlphaFactor;
					material.blendDst = THREE.OneMinusSrcAlphaFactor;
				}
				else if (node.renderFlags & NsRenderFlags.AlphaBlend2) {
					material.blending = THREE.CustomBlending;
					material.blendSrc = THREE.SrcAlphaFactor;
					material.blendDst = THREE.OneFactor;
				}
				else if (node.renderFlags & NsRenderFlags.AlphaBlend3) {

				}
				else {
					material.defines["_RENDERTYPE_OPAQUE"] = true;
				}

				if (node.renderFlags & NsRenderFlags.NoDepthWrite) {
					material.depthWrite = false;
				}

				if (node.renderFlags & NsRenderFlags.NoDepthTest) {
					material.depthFunc = THREE.AlwaysDepth;
				}

				if (node.renderFlags & NsRenderFlags.NoCull) {
					material.side = THREE.DoubleSide;
				}

				if (node.renderFlags & NsRenderFlags.FogDisable) {
					material.fog = false;
				}

				if (name.indexOf("fullscenerendertarget") != -1) {
					material.uniforms["g_TexRenderTarget"] = { value: Renderer.Instance.renderTarget.texture };
					material.defines["_FULLSCENERENDERTARGET"] = true;
				}
				else {
					if (mat.diffuse && mat.diffuse.length > 0)
					{
						const diffuse = await TextureLoader.load(this.refScene, mat.diffuse);
						if (diffuse != null) {
							material.uniforms["g_TexDiffuse"] = { value: diffuse };
						}
					}

					if (mat.secondary && mat.secondary.length > 0)
					{
						const secondary = await TextureLoader.load(this.refScene, mat.secondary);
						if (secondary != null)
						{
							secondary.wrapS = THREE.RepeatWrapping;
							secondary.wrapT = THREE.RepeatWrapping;
							material.uniforms["g_TexLightMap"] = { value: secondary };
							material.defines["_HAS_LIGHTMAP"] = true;
						}
					}
				}

				if (node.renderFlags & NsRenderFlags.NoMipMap)
				{
					if (material.defines["_RENDERTYPE_OPAQUE"] === undefined)
					{
						const map = material.uniforms["g_TexDiffuse"];
						if (map && map.value !== undefined)
						{
							const diffuse: THREE.CompressedTexture = map.value;
							diffuse.minFilter = THREE.LinearFilter;
							diffuse.magFilter = THREE.LinearFilter;
						}
					}
				}

				const indexStart = mat.faceStart * 3;
				const indexCount = mat.faceCount * 3;
				geometry.groups.push({ start: indexStart, count: indexCount, materialIndex: materials.length });

				materials.push(material);
			}
		}

		const mesh = new THREE.Mesh(geometry, materials);
		if (node.renderFlags & NsRenderFlags.AlphaTest) {
			mesh.renderOrder = 3000;
		}
		else if (node.renderFlags & NsRenderFlags.AlphaBlend1) {
			mesh.renderOrder = 4000;
		}
		else if (node.renderFlags & NsRenderFlags.AlphaBlend2) {
			mesh.renderOrder = 5000;
		}
		else if (node.renderFlags & NsRenderFlags.AlphaBlend3) {
			mesh.renderOrder = 6000;
		}
		else {
			mesh.renderOrder = 2000;
		}

		this.transformObject(mesh, node);

		if (name.indexOf("sector") != -1)
		{
			if (name.indexOf("1") != -1 && name.indexOf("ally") != -1) {
				return;
			}

			mesh.visible = false;
		}
		else if (name.startsWith("oct_")) {
			mesh.visible = false;
		}
		else
		{
			let parentIt = mesh.parent;
			let parentItLevel = 0;
			while (parentIt) {
				const isBlastGroup = parentIt.name.startsWith("blast1_") ||
					parentIt.name.startsWith("blast2_") ||
					parentIt.name.startsWith("blast3_");

				if (isBlastGroup && parentItLevel > 0) {
					mesh.visible = false;
					break;
				}

				++parentItLevel;
				parentIt = parentIt.parent;
			}
		}
	}

	async importBoxNode(node: NsBoxNode)
	{
		const object = new THREE.Object3D();
		this.transformObject(object, node);
	}

	async importBone(node: NsBone)
	{
		const object = new THREE.Object3D();
		this.transformObject(object, node);
	}

	async importBoneSystem(node: NsBoneSystem)
	{
		const object = new THREE.Object3D();
		this.transformObject(object, node);
	}

	transformObject(object: THREE.Object3D, node: NsSceneNode)
	{
		let iterator = 1;
		let name = node.name;

		while (this.nameToNode.has(name))
		{
			// duplicate name, attempt to make unique
			const num = iterator.toLocaleString("en-US", {
				minimumIntegerDigits: 2,
				useGrouping: false
			});

			name = `${node.name}_${num}`;
			++iterator;
		}

		node.name = name;
		object.name = node.name;

		// @ts-ignore
		object.sceneNode = node;
		//object.renderOrder += this.nameToObject.size;

		this.nameToObject.set(name, object);
		this.nameToNode.set(name, node);
		this.objectToNode.set(object, node);

		const parent = this.currentGroup.getObjectByName(node.parent);
		if (parent) {
			parent.add(object);
		}
		else {
			this.currentGroup.add(object);
		}

		const matrix = new THREE.Matrix4();
		matrix.set(
			node.matrix.m00, node.matrix.m01, node.matrix.m02, node.matrix.m30,
			node.matrix.m10, node.matrix.m11, node.matrix.m12, node.matrix.m31,
			node.matrix.m20, node.matrix.m21, node.matrix.m22, node.matrix.m32,
			node.matrix.m03, node.matrix.m13, node.matrix.m23, node.matrix.m33
		);

		const translation = new THREE.Vector3();
		const rotation = new THREE.Quaternion();
		const scale = new THREE.Vector3();
		matrix.decompose(translation, rotation, scale);

		//object.position.set(translation.x * 0.01, translation.z * 0.01, translation.y * 0.01);
		//object.rotation.setFromQuaternion(new THREE.Quaternion(-rotation.x, -rotation.z, -rotation.y, rotation.w));
		//object.scale.set(scale.x, scale.z, scale.y);

		//if (object.parent !== null) {
		//	tfm = object.parent.matrixWorld.invert().multiply(tfm);
		//}

		//object.matrix = tfm;
		//object.matrixWorld = tfm;

		//tfm.decompose(object.position, object.quaternion, object.scale);
		//object.updateMatrix();

		if (node.nodeType == NsNodeType.Geometry || node.nodeType == NsNodeType.Bone)
		{
			// @ts-ignore
			for (const animation of node.animations)
			{
				if (this.firstSceneAnim === "") {
					this.firstSceneAnim = animation.name;
				}

				break;
			}
		}
	}
}