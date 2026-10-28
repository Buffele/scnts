import { NsSceneNode } from './NsSceneNode';
import { CreateNodeFromType } from './NsScene';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { SeekOrigin } from '../IO/SeekOrigin';
import { NsNodeType } from './Constants/NsNodeType';

export class NsSceneGroup extends NsSceneNode
{
	nodes: NsSceneNode[] = [];
	reference: string = ''; // Shared-animation scene name.

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
		this.reference = '';
		if (this.version[1] >= 0.3) {
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

	/** Wrapped child records used by group version 0.3 and newer. */
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

		this.reference = reader.readString();
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
