import { NsSceneNode } from './NsSceneNode';
import { CreateNodeFromType } from './NsScene';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { SeekOrigin } from '../IO/SeekOrigin';
import { NsNodeType } from './Constants/NsNodeType';

export class NsSceneGroup extends NsSceneNode
{
	nodes: NsSceneNode[] = [];
	reference: string = ''; // Some skirts load from a reference file for animations. Not sure what else the use is.

	constructor(name: string = '', parent: string = '')
	{
		super(name, parent)
		this.nodeType = NsNodeType.SceneGroup;
	}

	Load(reader: NsBinaryReader): boolean
	{
		if (!super.Load(reader)) {
			return false;
		}

		this.version[1] = reader.readSingle();
		if (this.version[1] >= 0.3) {
			/*
			 * Xero import hack, remove as soon as possible
			 */
			return this.LoadConfused(reader);
		}

		let nodeCount = reader.readUInt32();
		if (this.version[1] >= 0.2) {
			this.reference = reader.readString();
		}

		this.nodes = [];
		for (let i = 0; i < nodeCount; ++i)
		{
			let type: NsNodeType = reader.readInt32();
			let node = CreateNodeFromType(type);
			if (!node.Load(reader))
				return false;

			this.nodes.push(node);
		}

		return true;
	}

	/*
	 * Xero import hack, remove as soon as possible.
	 */
	LoadConfused(reader: NsBinaryReader)
	{
		this.nodes = [];
		let nodeCount = reader.readUInt64();
		for (let i = 0; i < nodeCount; ++i)
		{
			reader.seek(9, SeekOrigin.Current);

			let type: NsNodeType = reader.readInt32();
			let node = CreateNodeFromType(type);
			if (!node.Load(reader))
				return false;

			reader.seek(1, SeekOrigin.Current);

			this.nodes.push(node);
		}

		reader.readString(); // Global Animation? Slipped my mind.
		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		return false;
	}

	GetAssetNames(): string[]
	{
		let results: string[] = [];
		for (const node of this.nodes)
		{
			let deps: string[] = node.GetAssetNames();
			results = results.concat(deps);
		}

		return results;
	}
}