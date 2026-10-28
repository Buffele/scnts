import { NsSceneNode } from './NsSceneNode';
import { NsSegment } from '../Common/NsSegment';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsNodeType } from './Constants/NsNodeType';
import { NsVector3 } from "../Common/NsMath";

export class NsShapeNode extends NsSceneNode
{
	segments : NsSegment[] = [];

	constructor(name = '', parent = '')
	{
		super(name, parent)
		this.nodeType = NsNodeType.ShapeNode;
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

		this.segments = [];
		let segmentCount = reader.readUInt32();
		for (let i = 0; i < segmentCount; ++i)
		{
			let start = reader.readVector3();
			let offset = reader.readVector3();

			let segment = new NsSegment();
			segment.start = start;
			segment.end = new NsVector3(start.x + offset.x, start.y + offset.y, start.z + offset.z);
			this.segments.push(segment);
		}

		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		if (this.version[1] < 0.1) return false;
		if (!super.Save(writer)) return false;
		writer.writeSingle(this.version[1]);
		writer.writeUInt32(this.segments.length);
		for (const segment of this.segments) {
			writer.writeVector3(segment.start);
			writer.writeVector3(new NsVector3(segment.end.x - segment.start.x,
				segment.end.y - segment.start.y, segment.end.z - segment.start.z));
		}
		return true;
	}
}
