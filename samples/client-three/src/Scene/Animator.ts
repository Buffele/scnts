import * as THREE from "three";
import { NsSceneGroup } from "@scnts/Scene/NsSceneGroup";
import { NsAnimation } from "@scnts/Animation/NsAnimation";
import { NsNodeType } from "@scnts/Scene/Constants/NsNodeType";
import { lerp } from "three/src/math/MathUtils";

export class Animator
{
	object: THREE.Object3D;
	sceneGroup: NsSceneGroup;

	isPlaying: boolean = false;
	currentTime: number = 0.0;
	playbackSpeed: number = 1.0;
	activeAnimName: string = "";
	activeAnims: Map<THREE.Object3D, NsAnimation> = new Map();

	constructor(object: THREE.Object3D, sceneGroup: NsSceneGroup)
	{
		this.object = object;
		this.sceneGroup = sceneGroup;
	}

	Play(name: string, blendTime: number = 0.2)
	{
		this.isPlaying = true;
		this.currentTime = 0.0;
		this.activeAnimName = name;
		this.activeAnims = this.GatherAnimations(this.activeAnimName);
	}

	Update(deltaTime: number)
	{
		//console.log(`deltaTime: ${deltaTime}`);

		let highestFrameCount = 0;
		const currentFrame = Math.floor(this.currentTime * 60.0 * 80.0);
		for (const [object, anim] of this.activeAnims)
		{
			const transformKeyData = anim.transformKeyData;
			const floatKeyData = anim.floatKeyData;
			const morphKeyData = anim.morphKeyData;

			let prevFrame = 0;

			if (transformKeyData !== undefined)
			{
				let position: any = transformKeyData.position;
				const positions = transformKeyData.positions;
				let rotation: any = transformKeyData.rotation;
				const rotations = transformKeyData.rotations;
				let scale: any = transformKeyData.scale;
				const scales = transformKeyData.scales;

				for (const [szFrame, value] of Object.entries(positions))
				{
					const frame = parseInt(szFrame);
					if (frame > currentFrame)
					{
						if (currentFrame != prevFrame)
						{
							const start = prevFrame;
							const end = frame;
							const current = currentFrame;

							const t = (currentFrame - start) / (end - start);
							const prevValue = new THREE.Vector3(position.x, position.y, position.z);
							// @ts-ignore
							const nextValue = new THREE.Vector3(value.x, value.y, value.z);

							position = prevValue.lerp(nextValue, t);
						}

						break;
					}

					position = value;
					prevFrame = frame;
				}

				for (const [szFrame, value] of Object.entries(rotations))
				{
					const frame = parseInt(szFrame);
					if (frame > currentFrame)
					{
						if (currentFrame != prevFrame)
						{
							const start = prevFrame;
							const end = frame;
							const current = currentFrame;

							const t = (currentFrame - start) / (end - start);
							const prevValue = new THREE.Quaternion(-rotation.x, -rotation.z, -rotation.y, rotation.w);
							// @ts-ignore
							const nextValue = new THREE.Quaternion(-value.x, -value.z, -value.y, value.w);

							rotation = prevValue.slerp(nextValue, t);
							rotation = new THREE.Quaternion(-rotation.x, -rotation.z, -rotation.y, rotation.w);
						}

						break;
					}

					rotation = value;
					prevFrame = frame;
				}

				for (const [szFrame, value] of Object.entries(scales))
				{
					const frame = parseInt(szFrame);
					if (frame > currentFrame)
					{
						if (currentFrame != prevFrame)
						{
							const start = prevFrame;
							const end = frame;
							const current = currentFrame;

							const t = (currentFrame - start) / (end - start);
							const prevValue = new THREE.Vector3(scale.x, scale.y, scale.z);
							// @ts-ignore
							const nextValue = new THREE.Vector3(value.x, value.y, value.z);

							scale = prevValue.lerp(nextValue, t);
						}

						break;
					}

					scale = value;
					prevFrame = frame;
				}

				object.position.set(position.x * 0.01, position.z * 0.01, position.y * 0.01);
				object.rotation.setFromQuaternion(new THREE.Quaternion(-rotation.x, -rotation.z, -rotation.y, rotation.w));
				object.scale.set(scale.x, scale.z, scale.y);
			}

			if (object instanceof THREE.Mesh)
			{
				const mesh = <THREE.Mesh> object;
				if (floatKeyData !== undefined)
				{
					let opacity: any = 1.0;
					const opacities = floatKeyData.opacities;
					for (const [szFrame, value] of Object.entries(opacities))
					{
						const frame = parseInt(szFrame);
						if (frame > currentFrame)
						{
							if (currentFrame != prevFrame)
							{
								const start = prevFrame;
								const end = frame;
								const current = currentFrame;

								const t = (currentFrame - start) / (end - start);
								const prevValue = opacity;
								const nextValue = value;

								// @ts-ignore
								opacity = lerp(opacity, value, t);
							}

							break;
						}

						opacity = value;
						prevFrame = frame;
					}

					// @ts-ignore
					for (const material of mesh.material) {
						material.uniforms.opacity.value = opacity;
					}

					// if (opacity < 0.01) {
					// 	mesh.visible = false;
					// }
					// else {
					// 	mesh.visible = true;
					// }
				}

				if (morphKeyData !== undefined)
				{
					const morphs = morphKeyData.morphs;
					if (Object.entries(morphs).length > 0)
					{
						const geometry = mesh.geometry;
						const vertices = geometry.attributes.position;
						const uvs = geometry.attributes.uv;

						let morph: any = null;
						for (const [szFrame, value] of Object.entries(morphs))
						{
							const frame = parseInt(szFrame);
							if (frame > currentFrame)
							{
								if (currentFrame != prevFrame)
								{
									const start = prevFrame;
									const end = frame;
									const current = currentFrame;
									const t = (currentFrame - start) / (end - start);

									for (const [szVertId, posValue] of Object.entries(value.vertices))
									{
										const vertId = parseInt(szVertId);
										const prevValue: any = morph.vertices[szVertId];
										const nextValue: any = posValue;

										vertices.setX(vertId, lerp(prevValue.x, nextValue.x, t) * 0.01);
										vertices.setZ(vertId, lerp(prevValue.y, nextValue.y, t) * 0.01);
										vertices.setY(vertId, lerp(prevValue.z, nextValue.z, t) * 0.01);
									}

									for (const [szVertId, uvValue] of Object.entries(value.uv))
									{
										const vertId = parseInt(szVertId);
										const prevValue: any = morph.uv[szVertId];
										const nextValue: any = uvValue;

										uvs.setX(vertId, lerp(prevValue.x, nextValue.x, t));
										uvs.setY(vertId, lerp(prevValue.y, nextValue.y, t));
									}
								}

								break;
							}

							morph = value;
							prevFrame = frame;
						}

						vertices.needsUpdate = true;
						uvs.needsUpdate = true;

						geometry.setAttribute('position', vertices);
						geometry.setAttribute('uv', uvs);
					}
				}
			}

			highestFrameCount = Math.max(highestFrameCount, anim.frameCount);
		}

		if (this.isPlaying) {
			this.currentTime += deltaTime * this.playbackSpeed;
		}

		if (highestFrameCount > 0)
		{
			const highestTime = highestFrameCount / 80.0 / 60.0;
			while (this.currentTime > highestTime) {
				this.currentTime -= highestTime; // Loops animation.
			}
		}
		else {
			this.currentTime = 0;
		}
	}

	GetObjectByName(name: string, iterator: THREE.Object3D | null = null): THREE.Object3D | null
	{
		if (iterator == null) {
			iterator = this.object;
		}

		if (iterator.name == name) {
			return iterator;
		}

		for (const child of iterator.children) {
			const result = this.GetObjectByName(name, child);
			if (result != null) {
				return result;
			}
		}

		return null;
	}

	GatherAnimations(name: string): Map<THREE.Object3D, NsAnimation>
	{
		const results = new Map();
		for (const node of this.sceneGroup.nodes)
		{
			if (node.nodeType == NsNodeType.Geometry || node.nodeType == NsNodeType.Bone)
			{
				// @ts-ignore
				for (const animation: NsAnimation of node.animations)
				{
					if (animation.name === name)
					{
						const object = this.GetObjectByName(node.name);
						if (object == null) {
							break; // oct_ will cause failure for now since we don't add them to the scene.
							//throw 'Failed to find object.';
						}

						results.set(object, animation);
						break;
					}
				}
			}
		}

		return results;
	}

	GetFrameCount(): number
	{
		//console.log(`deltaTime: ${deltaTime}`);

		let highestFrameCount = 0;
		for (const [object, anim] of this.activeAnims) {
			highestFrameCount = Math.max(highestFrameCount, anim.frameCount);
		}

		return highestFrameCount;
	}

	GetAnimationNames(): string[]
	{
		let results: string[] = [];
		for (const [object, anim] of this.activeAnims)
		{
			if (results.includes(anim.name)) {
				continue;
			}

			results.push(anim.name);
		}

		return results;
	}
}