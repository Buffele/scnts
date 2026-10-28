import { NsSceneNode } from './NsSceneNode';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsNodeType } from './Constants/NsNodeType';
import { NsSceneGroup } from './NsSceneGroup';
import { NsLightNode } from './NsLightNode';
import { NsGeometry } from './NsGeometry';
import { NsShapeNode } from './NsShapeNode';
import { NsBoxNode } from './NsBoxNode';
import { NsBone } from './NsBone';
import { NsBoneSystem } from './NsBoneSystem';
import fs, { promises as fsAsync } from 'fs';
import path from 'path';
import { NsSphereNode } from './NsSphereNode';
import { DecodeSceneBuffer } from '../IO/NsAssetCrypt';

export interface NsSceneHeader {
	maxVersion: number;
	sceneVersion: number;
	nodeCount: number;
	reserved1: number;
	reserved2: number;
}

export interface NsSceneLoadOptions {
	lightLayout?: 'standard' | 'alternate';
}

export function CreateNodeFromType(type: NsNodeType): NsSceneNode {
	if (type == NsNodeType.SceneGroup)
		return new NsSceneGroup();
	else if (type == NsNodeType.LightNode)
		return new NsLightNode();
	else if (type == NsNodeType.Geometry)
		return new NsGeometry();
	else if (type == NsNodeType.ShapeNode)
		return new NsShapeNode();
	else if (type == NsNodeType.BoxNode)
		return new NsBoxNode();
	else if (type == NsNodeType.Bone)
		return new NsBone();
	else if (type == NsNodeType.BoneSystem)
		return new NsBoneSystem();
	else if (type == NsNodeType.SphereNode)
		return new NsSphereNode();
	else
		throw `unknown node type ${NsNodeType[type]}:${type}`;
}

export function ResolveFilePath(directory: string, filename: string): string  {
	/* Respect order. */
	const exts = [
		'.dds',
		'.png',
		'.tga',
		'.jpg',
		'.bmp'
	];

	let filenameWithoutExt = filename;
	if (path.extname(filenameWithoutExt).length > 0) {
		filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
	}

	for (const ext of exts) {
		const pathWithExt = path.join(directory, filenameWithoutExt + ext);
		if (fs.existsSync(pathWithExt)) {
			return pathWithExt;
		}
	}

	/* Return original input if no file was found. */
	return path.join(directory, filename);
}

export async function TryLoadTexture(path: string): Promise<Buffer | null> {
	if (!fs.existsSync(path)) {
		return null;
	}

	return await fsAsync.readFile(path);
}

export class NsScene {
	fileVersion: number = 1;
	header: NsSceneHeader | null = null;
	filePath: string = ''; // left empty if loaded from memory buffer.
	nodes: NsSceneNode[] = [];

	static LoadFromBuffer(buffer: Buffer, options: NsSceneLoadOptions = {}): NsScene | null {
		const scene = new NsScene();
		return scene.Load(new NsBinaryReader(buffer), options) ? scene : null;
	}

	static LoadFromFile(path: string, options: NsSceneLoadOptions = {}): NsScene | null {
		const scene = new NsScene();
		const reader = NsBinaryReader.openFile(path);
		if (reader == null) {
			return null;
		}

		if (!scene.Load(reader, options)) {
			return null;
		}

		return scene;
	}

	Load(reader: NsBinaryReader, options: NsSceneLoadOptions = {}) {
		if (reader.offset === 0) reader.handle = DecodeSceneBuffer(reader.handle);
		reader.lightLayout = options.lightLayout ?? reader.lightLayout;
		this.header = null;
		this.fileVersion = reader.readUInt32();
		this.filePath = reader.name;

		let nodeCount = 1;
		if (this.fileVersion != 1) {
			const maxVersion = reader.readUInt32();
			const sceneVersion = reader.readUInt32();
			nodeCount = reader.readUInt32();
			const reserved1 = reader.readUInt32();
			const reserved2 = reader.readUInt32();
			this.header = { maxVersion, sceneVersion, nodeCount, reserved1, reserved2 };
		}

		this.nodes = [];
		for (let i = 0; i < nodeCount; ++i) {
			const type = reader.readInt32();
			const node = CreateNodeFromType(type);
			if (!node.Load(reader))
				return false;

			this.nodes.push(node);
		}

		return true;
	}

	GetAssetNames(): string[] {
		let results: string[] = [];
		for (const node of this.nodes) {
			results = results.concat(node.GetAssetNames());
		}

		results = [ ...new Set(results) ];
		results.sort();

		/* Resolve filenames. */
		const directory = path.dirname(this.filePath);
		for (let i = 0; i < results.length; ++i) {
			const fileName = results[i];
			results[i] = path.basename(ResolveFilePath(directory, fileName));
		}

		return [...new Set(results)].sort();
	}

	/*GetAssetData(): Map<string, string> {
		const results = new Map<string, string>();
		const directory = path.dirname(this.filePath);
		const names = this.GetAssetNames();
		for (const filename of names) {
			const absolutePath = path.join(directory, filename);
			const dataBase64 = TryLoadTexture(absolutePath);
			results.set(filename, dataBase64 ?? '');
		}

		return results;
	}*/
}
