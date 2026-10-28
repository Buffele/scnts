import { NsSceneNode } from './NsSceneNode';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsNodeType } from './Constants/NsNodeType';
import { NsVector4 } from '../Common/NsMath';

export class NsSphereNode extends NsSceneNode
{
	unk: NsVector4 = new NsVector4();

	constructor(name = '', parent = '')
	{
		super(name, parent)
		this.nodeType = NsNodeType.SphereNode;
	}

	Load(reader: NsBinaryReader): boolean
	{
		if (!super.Load(reader)) {
			return false;
		}

		this.version[1] = reader.readSingle();
		if (this.version[1] < 0.1) {
			return false;
		}

		this.version[2] = reader.readSingle();

		this.unk = reader.readVector4();

		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		return true;
	}
}