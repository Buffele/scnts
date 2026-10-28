import { NsScene } from '@scnts/Scene/NsScene';
import * as THREE from 'three';
import { DDSLoader } from 'three/examples/jsm/loaders/DDSLoader';

export class TextureLoader
{
	static cache: Map<string, THREE.CompressedTexture | undefined> = new Map();
	static loader = new DDSLoader();

	static async load(scene: NsScene, filename: string): Promise<THREE.CompressedTexture | undefined>
	{
		let filenameWithoutExt = filename;
		if (filename.indexOf('.') != -1) {
			filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
		}

		if (this.cache.has(filenameWithoutExt)) {
			return this.cache.get(filenameWithoutExt);
		}

		// @ts-ignore
		const url = new URL('http://127.0.0.1:4444');
		url.pathname = 'resource';
		url.searchParams.set('sceneFilePath', scene.filePath);
		url.searchParams.set('filename', filenameWithoutExt);

		const response = await fetch(url);
		if (response.status !== 200) {
			console.warn(`Failed to load texture: ${filename}`)
			this.cache.set(filenameWithoutExt, undefined);
			return undefined;
		}

		console.log(`Loading texture: ${filenameWithoutExt}`);
		const data = await response.arrayBuffer();
		if (data.byteLength === 0) {
			console.warn(`Texture has 0 bytes: ${filename}`)
			this.cache.set(filenameWithoutExt, undefined);
			return undefined;
		}

		try
		{
			// @ts-ignore
			const texture = new THREE.CompressedTexture();
			const texDatas = this.loader.parse(data, true);
			if (!texDatas.format) {
				console.warn(`Texture could not be parsed: ${filename}`)
				this.cache.set(filenameWithoutExt, undefined);
				return undefined;
			}

			if (texDatas.isCubemap)
			{
				let images = [];
				const faces = texDatas.mipmaps.length / texDatas.mipmapCount;
				for (let f = 0; f < faces; ++f)
				{
					images[f] = { mipmaps: [] };
					for (let i = 0; i < texDatas.mipmapCount; ++i)
					{
						// @ts-ignore
						images[f].mipmaps.push(texDatas.mipmaps[ f * texDatas.mipmapCount + i ]);
						// @ts-ignore
						images[f].format = texDatas.format;
						// @ts-ignore
						images[f].width = texDatas.width;
						// @ts-ignore
						images[f].height = texDatas.height;
					}
				}

				// @ts-ignore
				texture.image = images;
			}
			else
			{
				texture.image.width = texDatas.width;
				texture.image.height = texDatas.height;
				// @ts-ignore
				texture.mipmaps = texDatas.mipmaps;
			}

			if (texDatas.mipmapCount === 1) {
				texture.minFilter = THREE.LinearFilter;
			}

			// @ts-ignore
			texture.format = texDatas.format;
			texture.needsUpdate = true;

			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;

			texture.name = filenameWithoutExt;
			this.cache.set(filenameWithoutExt, texture);
			return texture;
		} catch (e) {
			console.warn(`Texture threw exception: ${filename}`)
			this.cache.set(filenameWithoutExt, undefined);
			return undefined;
		}
	}

	static async preload(scene: NsScene, assets: string[]): Promise<void>
	{
		if (assets.length === 0) {
			return;
		}

		const name = scene.filePath.substring(scene.filePath.lastIndexOf('/') + 1);

		console.log(`Precaching ${assets.length} textures for ${name}`);

		const tasks = [];

		for (const asset of assets) {
			tasks.push(this.load(scene, asset));
		}

		await Promise.all(tasks);

		console.log(`Done precaching textures for ${name}`);
	}

	static clearCache(): void
	{
		this.cache.clear();
	}
}