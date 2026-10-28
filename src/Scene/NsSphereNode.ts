import { NsSceneNode } from './NsSceneNode';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsNodeType } from './Constants/NsNodeType';
import { NsVector3, NsVector4 } from '../Common/NsMath';

export class NsSphereNode extends NsSceneNode
{
	unk: NsVector4 = new NsVector4();
	get center(): NsVector3 { return new NsVector3(this.unk.x, this.unk.y, this.unk.z); }
	set center(value: NsVector3) { this.unk.x = value.x; this.unk.y = value.y; this.unk.z = value.z; }
	get radius(): number { return this.unk.w; }
	set radius(value: number) { this.unk.w = value; }

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
		if (this.version[2] < 0.1) return false;

		this.unk = reader.readVector4();

		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		if (this.version[1] < 0.1 || this.version[2] < 0.1) return false;
		if (!super.Save(writer)) return false;
		writer.writeSingle(this.version[1]);
		writer.writeSingle(this.version[2]);
		writer.writeVector3(this.center);
		writer.writeSingle(this.radius);
		return true;
	}
}
