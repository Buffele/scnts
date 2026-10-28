import * as THREE from "three";
import './deps/imgui.umd.js';
import './deps/imgui_impl.umd.js';

export class ImControls
{
	static Transform(position: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3)
	{
		let changed = false;
		const handler1 = (value = [ position.x, position.y, position.z ]) => {
			// @ts-ignore
			position = new THREE.Vector3(value[0], value[1], value[2])
		};

		// @ts-ignore
		if (ImGui.DragFloat3("Position", position, 0.2, 0.0, 0.0, "%.2f")) {
			changed = true;
		}

		const euler = new THREE.Euler();
		euler.setFromQuaternion(rotation);

		const handler2 = (value = new THREE.Vector3(
			euler.x * THREE.MathUtils.RAD2DEG,
			euler.y * THREE.MathUtils.RAD2DEG,
			euler.z * THREE.MathUtils.RAD2DEG
		)) => {
			rotation = new THREE.Quaternion();
			rotation.setFromEuler(
				// @ts-ignore
				value[0] * THREE.MathUtils.DEG2RAD,
				// @ts-ignore
				value[1] * THREE.MathUtils.DEG2RAD,
				// @ts-ignore
				value[2] * THREE.MathUtils.DEG2RAD
			);
		};

		const rotationAngles = new THREE.Vector3(
			euler.x * THREE.MathUtils.RAD2DEG,
			euler.y * THREE.MathUtils.RAD2DEG,
			euler.z * THREE.MathUtils.RAD2DEG
		);

		// @ts-ignore
		if (ImGui.DragFloat3("Rotation", rotationAngles, 0.1, 0.0, 0.0, "%.2f")) {
			rotation.setFromEuler(
				new THREE.Euler(
					rotationAngles.x * THREE.MathUtils.DEG2RAD,
					rotationAngles.y * THREE.MathUtils.DEG2RAD,
					rotationAngles.z * THREE.MathUtils.DEG2RAD
				)
			);

			changed = true;
		}

		const handler3 = (value = position) => {
			// @ts-ignore
			position = new THREE.Vector3(value[0], value[1], value[2])
		};

		// @ts-ignore
		if (ImGui.DragFloat3("Scale", scale, 0.05, 0.0, 0.0, "%.2f")) {
			changed = true;
		}

		return changed;
	}
}