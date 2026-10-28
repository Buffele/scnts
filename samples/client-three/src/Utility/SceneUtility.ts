import * as THREE from "three";

export function GetViewDistance(object: THREE.Object3D, iterator: number = 5): number
{
	if (object.name.startsWith("sky_")) {
		return iterator;
	}

	if (object instanceof THREE.Mesh)
	{
		const mesh = <THREE.Mesh> object;
		const geometry = mesh.geometry;
		const positions: Float32Array = <Float32Array> geometry.attributes["position"].array;
		for (const vertex of positions) {
			iterator = Math.max(iterator, vertex);
		}
	}

	for (const child of object.children) {
		iterator = GetViewDistance(child, iterator);
	}

	return iterator;
}