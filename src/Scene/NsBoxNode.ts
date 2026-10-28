import { NsSceneNode } from './NsSceneNode';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsNodeType } from './Constants/NsNodeType';
import { NsVector3 } from "../Common/NsMath";

export class NsBoxNode extends NsSceneNode
{
	center: NsVector3 = new NsVector3(0, 0, 0);
	axisX: NsVector3 = new NsVector3(1, 0, 0);
	axisY: NsVector3 = new NsVector3(0, 1, 0);
	axisZ: NsVector3 = new NsVector3(0, 0, 1);
	extents: NsVector3 = new NsVector3(0, 0, 0);

	constructor(name: string = '', parent: string = '')
	{
		super(name, parent);
		this.nodeType = NsNodeType.BoxNode;
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
		if (this.version[2] < 0.1) {
			return false;
		}

		this.center = reader.readVector3();
		this.axisX = reader.readVector3();
		this.axisY = reader.readVector3();
		this.axisZ = reader.readVector3();
		this.extents = reader.readVector3();

		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		if (this.version[1] < 0.1 || this.version[2] < 0.1) return false;
		if (!super.Save(writer)) {
			return false;
		}

		writer.writeSingle(this.version[1]);
		if (this.version[1] < 0.1) {
			return false;
		}

		writer.writeSingle(this.version[2]);
		if (this.version[2] < 0.1) {
			return false;
		}

		writer.writeVector3(this.center);
		writer.writeVector3(this.axisX);
		writer.writeVector3(this.axisY);
		writer.writeVector3(this.axisZ);
		writer.writeVector3(this.extents);

		return true;
	}
}
