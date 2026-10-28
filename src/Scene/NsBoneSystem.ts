import { NsSceneNode } from './NsSceneNode';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsNodeType } from './Constants/NsNodeType';

export class NsBoneSystem extends NsSceneNode
{
	constructor(name: string = '', parent: string = '')
	{
		super(name, parent);
		this.nodeType = NsNodeType.BoneSystem;
	}

	Load(reader: NsBinaryReader): boolean
	{
		if (!super.Load(reader))
			return false;

		this.version.push(reader.readSingle());
		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		if (!super.Save(writer))
			return false;

		writer.writeSingle(this.version[1]);
		return true;
	}
}