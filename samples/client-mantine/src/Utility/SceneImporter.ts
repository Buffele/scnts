import { NsScene } from "@scnts/Scene/NsScene";
import { NsSceneNode } from "@scnts/Scene/NsSceneNode";
import { NsNodeType } from "@scnts/Scene/Constants/NsNodeType";
import { NsSceneGroup } from "@scnts/Scene/NsSceneGroup";
import { NsGeometry } from "@scnts/Scene/NsGeometry";
import { NsBoxNode } from "@scnts/Scene/NsBoxNode";
import { NsBone } from "@scnts/Scene/NsBone";
import { NsBoneSystem } from "@scnts/Scene/NsBoneSystem";
import { NsRenderFlags } from "@scnts/Scene/Constants/NsRenderFlags";
import * as BABYLON from "@babylonjs/core";
import { NsRenderType } from "@scnts/Scene/Constants/NsRenderType";

export class SceneImporter
{
	scene: BABYLON.Scene;
	refScene: NsScene;

	currentGroup: BABYLON.TransformNode | null;
	topObjects: BABYLON.TransformNode[] = [];
	// animators: Animator[] = [];

	firstSceneAnim: string = "";

	objectToNode: Map<BABYLON.TransformNode, NsSceneNode> = new Map();
	nameToNode: Map<string, NsSceneNode> = new Map();
	nameToObject: Map<string, BABYLON.TransformNode> = new Map();

	textures: Map<string, BABYLON.Texture> = new Map();

	constructor(scene: BABYLON.Scene, refScene: NsScene)
	{
		this.scene = scene;
		this.refScene = refScene;
		this.currentGroup = null;
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
		} else if (node.nodeType == NsNodeType.Geometry) {
			await this.importGeometry(<NsGeometry> node);
		} else if (node.nodeType == NsNodeType.BoxNode) {
			await this.importBoxNode(<NsBoxNode> node);
		} else if (node.nodeType == NsNodeType.Bone) {
			await this.importBone(<NsBone> node);
		} else if (node.nodeType == NsNodeType.BoneSystem) {
			await this.importBoneSystem(<NsBoneSystem> node);
		}
	}

	async importSceneGroup(group: NsSceneGroup)
	{
		const object = new BABYLON.TransformNode(group.name, this.scene);
		this.transformObject(object, group);
		this.topObjects.push(object);

		this.currentGroup = object;
		for (const node of group.nodes) {
			await this.importNode(node);
		}

		/*
		if (this.firstSceneAnim != "")
		{
			const animator = new Animator(object, group);
			animator.Play(this.firstSceneAnim, 0.0);
			this.animators.push(animator);
		}

		*/
		this.currentGroup = null;
	}

	async importGeometry(node: NsGeometry)
	{
		const name = node.name;
		const object = new BABYLON.Mesh(name, this.scene);
		const vertexData = new BABYLON.VertexData();

		const vertices = [];
		for (let i = 0; i < node.vertices.length; ++i)
		{
			let value = node.vertices[i];
			vertices.push(value.x * 0.01);
			vertices.push(value.y * 0.01);
			vertices.push(value.z * 0.01);
		}
		vertexData.positions = vertices;

		const normals = [];
		for (let i = 0; i < node.normals.length; ++i)
		{
			const value = node.normals[i];
			normals.push(value.x);
			normals.push(value.y);
			normals.push(value.z);
		}
		vertexData.normals = normals;

		const indices = [];
		for (let i = 0; i < node.triangles.length; i += 3)
		{
			indices.push(node.triangles[i]);
			indices.push(node.triangles[i + 1]);
			indices.push(node.triangles[i + 2]);
		}
		vertexData.indices = indices;

		const uvs = [];
		for (let i = 0; i < node.uv.length; ++i)
		{
			let uv = node.uv[i];
			uvs.push(uv.x);
			uvs.push(uv.y);
		}
		vertexData.uvs = uvs;

		if (node.renderType == NsRenderType.DiffuseLightmap)
		{
			const uvs2 = [];
			for (let i = 0; i < node.uv2.length; ++i)
			{
				let uv = node.uv2[i];
				uvs2.push(uv.x);
				uvs2.push(uv.y);
			}
			vertexData.uvs2 = uvs2;
		}

		vertexData.applyToMesh(object);

		const multiMat = new BABYLON.MultiMaterial(node.name, this.scene);
		multiMat.sideOrientation = 0;

		object.subMeshes = [];
		const vertexCount = object.getTotalVertices();

		for (const mat of node.materials)
		{
			let diffuse: any = null;
			let secondary: any = null;

			if (mat.diffuse && mat.diffuse.length > 0) {
				diffuse = this.getTexture(mat.diffuse);
			}

			if (mat.secondary && mat.secondary.length > 0) {
				secondary = this.getTexture(mat.secondary);
			}

			const material = new BABYLON.PBRMaterial(mat.diffuse, this.scene);
			material.unlit = true;

			material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
			material.sideOrientation = 0;

			if (diffuse)
			{
				material.albedoTexture = diffuse;

				const isTransparent =
					node.renderFlags & NsRenderFlags.AlphaBlend1 ||
					node.renderFlags & NsRenderFlags.AlphaBlend2 ||
					node.renderFlags & NsRenderFlags.AlphaBlend3;

				if (node.renderFlags & NsRenderFlags.AlphaTest) {
					//diffuse.hasAlpha = true;
					//diffuse.getAlphaFromRGB = true;

					diffuse.hasAlpha = true;
					material.forceAlphaTest = true;
					material.alphaCutOff = 0.5;


					//material.opacityTexture = diffuse;
					//material.useAlphaFromAlbedoTexture = true;
				}

				if (isTransparent) {
					diffuse.hasAlpha = true;
					material.useAlphaFromAlbedoTexture = true;
				}

				if (node.renderFlags & NsRenderFlags.AlphaTest) {
					material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
				}
				else if (node.renderFlags & NsRenderFlags.AlphaBlend1) {
					material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
					material.alphaMode = 2;
				}
				else if (node.renderFlags & NsRenderFlags.AlphaBlend2) {
					material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
					material.alphaMode = 1;
				}
				else if (node.renderFlags & NsRenderFlags.AlphaBlend3) {
					material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
					material.alphaMode = 3;
				}
			}

			if (secondary) {
				material.useLightmapAsShadowmap = true;
				material.lightmapTexture = secondary;
				if (material.lightmapTexture) {
					material.lightmapTexture.coordinatesIndex = 1;
					material.lightmapTexture.level = 4.59479380;
				}
			}

			if (node.renderFlags & NsRenderFlags.NoDepthWrite) {
				material.disableDepthWrite = true;
			}

			if (node.renderFlags & NsRenderFlags.NoDepthTest) {
				material.depthFunction = BABYLON.Engine.ALWAYS;
			}

			if (node.renderFlags & NsRenderFlags.NoCull) {
				material.backFaceCulling = false;
			}

			if (node.renderFlags & NsRenderFlags.FogDisable) {
				material.fogEnabled = false;
			}

			multiMat.subMaterials.push(material);

			/*let diffuse: BABYLON.Texture | undefined = undefined;
			let secondary: BABYLON.Texture | undefined = undefined;
			let defines: string[] = [];
			let needAlphaBlend = false;
			let needAlphaTest = false;

			if (mat.diffuse && mat.diffuse.length > 0) {
				diffuse = this.getTexture(mat.diffuse);
			}

			if (mat.secondary && mat.secondary.length > 0)
			{
				secondary = this.getTexture(mat.secondary);
				if (secondary) {
					defines.push("_HAS_LIGHTMAP");
				}
			}

			const isTransparent = node.renderFlags & NsRenderFlags.AlphaTest ||
				node.renderFlags & NsRenderFlags.AlphaBlend1 ||
				node.renderFlags & NsRenderFlags.AlphaBlend2 ||
				node.renderFlags & NsRenderFlags.AlphaBlend3;

			if (diffuse && isTransparent) {
				diffuse.hasAlpha = true;
			}

			if (node.renderFlags & NsRenderFlags.AlphaTest) {
				needAlphaTest = true;
			}
			else if (node.renderFlags & NsRenderFlags.AlphaBlend1) {
				needAlphaBlend = true;
			}
			else if (node.renderFlags & NsRenderFlags.AlphaBlend2) {
				needAlphaBlend = true;
			}
			else if (node.renderFlags & NsRenderFlags.AlphaBlend3) {
				needAlphaBlend = true;
			}

			const material = new BABYLON.ShaderMaterial(mat.diffuse, this.scene, "./shader/shader",
				{
					attributes: ["position", "normal", "uv", "uv2"],
					uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "time", "direction" ],
					samplers: ["g_TexDiffuseMap", "g_TexLightMap"],
					defines: defines,
					needAlphaBlending: needAlphaBlend,
					needAlphaTesting: needAlphaTest
				});

			if (diffuse) {
				material.setTexture("g_TexDiffuseMap", diffuse);
			}

			if (secondary) {
				material.setTexture("g_TexLightMap", secondary);
			}

			material.sideOrientation = 0;
			material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;

			if (node.renderFlags & NsRenderFlags.AlphaTest) {
				material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
			}
			else if (node.renderFlags & NsRenderFlags.AlphaBlend1) {
				material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
				material.alphaMode = 2;
			}
			else if (node.renderFlags & NsRenderFlags.AlphaBlend2) {
				material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
				material.alphaMode = 1;
			}
			else if (node.renderFlags & NsRenderFlags.AlphaBlend3) {
				material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
				material.alphaMode = 3;
			}

			if (node.renderFlags & NsRenderFlags.NoDepthWrite) {
				material.disableDepthWrite = true;
			}

			if (node.renderFlags & NsRenderFlags.NoDepthTest) {
				material.depthFunction = BABYLON.Engine.ALWAYS;
			}

			if (node.renderFlags & NsRenderFlags.NoCull) {
				material.backFaceCulling = false;
			}

			if (node.renderFlags & NsRenderFlags.FogDisable) {
				material.fogEnabled = false;
			}

			multiMat.subMaterials.push(material);*/
		}

		object.material = multiMat;

		// Define submeshes
		for (const mat of node.materials)
		{
			new BABYLON.SubMesh(
				object.subMeshes.length,
				0, vertexCount,
				mat.faceStart * 3, mat.faceCount * 3,
				object
			);
		}

		this.transformObject(object, node);

		if (name.indexOf("sector") != -1)
		{
			if (name.indexOf("1") != -1 && name.indexOf("ally") != -1) {
				return;
			}

			object.setEnabled(false);
		}
		else if (name.startsWith("oct_")) {
			object.setEnabled(false);
		}
		else
		{
			let parentIt = object.parent;
			let parentItLevel = 0;
			while (parentIt) {
				const isBlastGroup = parentIt.name.startsWith("blast1_") ||
					parentIt.name.startsWith("blast2_") ||
					parentIt.name.startsWith("blast3_");

				if (isBlastGroup && parentItLevel > 0) {
					object.setEnabled(false);
					break;
				}

				++parentItLevel;
				parentIt = parentIt.parent;
			}
		}

		/*
		for (const mat of node.materials) {
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
				material.depthTest = false;
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
			} else {
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
		*/

		/*
		if (node.renderFlags & NsRenderFlags.AlphaTest) {
			mesh.renderingGroupId = 3000;
		} else if (node.renderFlags & NsRenderFlags.AlphaBlend1) {
			mesh.renderingGroupId = 4000;
		} else if (node.renderFlags & NsRenderFlags.AlphaBlend2) {
			mesh.renderingGroupId = 5000;
		} else if (node.renderFlags & NsRenderFlags.AlphaBlend3) {
			mesh.renderingGroupId = 6000;
		} else {
			mesh.renderingGroupId = 2000;
		}
		*/

		/*
		// this.transformObject(mesh, node);

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
		*/
	}


	async importBoxNode(node: NsBoxNode)
	{
		const object = new BABYLON.TransformNode(node.name, this.scene);
		this.transformObject(object, node);
	}

	async importBone(node: NsBone)
	{
		const object = new BABYLON.TransformNode(node.name, this.scene);
		this.transformObject(object, node);
	}

	async importBoneSystem(node: NsBoneSystem)
	{
		const object = new BABYLON.TransformNode(node.name, this.scene);
		this.transformObject(object, node);
	}

	transformObject(object: BABYLON.TransformNode, node: NsSceneNode)
	{
		let iterator = 1;
		let name = node.name;

		while (this.nameToNode.has(name)) {
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
		//object.renderOrder += this.nameToObject.size;

		this.nameToObject.set(name, object);
		this.nameToNode.set(name, node);
		this.objectToNode.set(object, node);

		if (this.nameToObject.has(node.parent))
		{
			const parent = this.nameToObject.get(node.parent);
			if (parent != undefined) {
				object.parent = parent;
			}
		}

		if (object.parent == null) {
			object.parent = this.currentGroup;
		}

		const matrix = BABYLON.Matrix.FromValues(
			node.matrix.m00,
			node.matrix.m01,
			node.matrix.m02,
			node.matrix.m03,
			node.matrix.m10,
			node.matrix.m11,
			node.matrix.m12,
			node.matrix.m13,
			node.matrix.m20,
			node.matrix.m21,
			node.matrix.m22,
			node.matrix.m23,
			node.matrix.m30,
			node.matrix.m31,
			node.matrix.m32,
			node.matrix.m33,
		);

		/*const translation = new Vector3();
		const rotation = new Quaternion();
		const scale = new Vector3();
		matrix.decompose(translation, rotation, scale);

		const matrixWorld = new Matrix();
		matrixWorld.compose(
			new THREE.Vector3(translation.x * 0.01, translation.z * 0.01, translation.y * 0.01),
			new THREE.Quaternion(-rotation.x, -rotation.z, -rotation.y, rotation.w),
			new THREE.Vector3(scale.x, scale.z, scale.y),
		);

		object.matrixWorld = matrixWorld;*/

		if (node.nodeType == NsNodeType.Geometry || node.nodeType == NsNodeType.Bone)
		{
			// @ts-ignore
			for (const animation of node.animations)
			{
				if (this.firstSceneAnim === "") {
					this.firstSceneAnim = animation.name;
				}

				const transformKeyData = animation.transformKeyData;
				if (transformKeyData)
				{
					const position = transformKeyData.position;
					const rotation = transformKeyData.rotation;
					const scale = transformKeyData.scale;

					object.position = new BABYLON.Vector3(position.x * 0.01, position.y * 0.01, position.z * 0.01);
					object.rotationQuaternion = new BABYLON.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
					object.scaling = new BABYLON.Vector3(scale.x, scale.y, scale.z);

					//object.position.set(position.x * 0.01, position.z * 0.01, position.y * 0.01);
					//object.rotation.setFromQuaternion(new THREE.Quaternion(-rotation.x, -rotation.z, -rotation.y, rotation.w));
					//object.scale.set(scale.x, scale.z, scale.y);
				}

				//const floatKeyData = animation.floatKeyData;
				//if (floatKeyData)
				//{
				//	if (Object.keys(floatKeyData.opacities).length > 0)
				//	{
				//		const firstKey = Object.keys(floatKeyData.opacities)[0];
				//		if (object instanceof Mesh)
				//		{
				//			const mesh = <THREE.Mesh> object;
				//			// @ts-ignore
				//			for (const material: THREE.Material of mesh.material) {
				//				material.uniforms.opacity.value = floatKeyData.opacities[firstKey];
				//			}
				//		}
				//	}
				//}

				break;
			}
		}
	}

	getTexture(filename: string)
	{
		let filenameWithoutExt = filename;
		if (filename.indexOf('.') != -1) {
			filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
		}

		if (this.textures.has(filenameWithoutExt)) {
			return this.textures.get(filenameWithoutExt);
		}

		const url = new URL('http://127.0.0.1:4444');
		url.pathname = 'resource';
		url.searchParams.set('sceneFilePath', this.refScene.filePath);
		url.searchParams.set('filename', filenameWithoutExt + '.dds');

		console.log(`Loading texture ${filename}`);
		const texture = new BABYLON.Texture(null, this.scene, {}, false);
		texture.updateURL(url.toString());
		if (texture != null) {
			texture.name = filename;
		}

		this.textures.set(filenameWithoutExt, texture);
		return texture;
	}
}