import { NsSceneNode } from './NsSceneNode';
import { NsAnimation } from '../Animation/NsAnimation';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsTransformKeyData } from '../Animation/NsTransformKeyData';
import { SeekOrigin } from '../IO/SeekOrigin';
import { NsFloatKeyData } from '../Animation/NsFloatKeyData';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsNodeType } from './Constants/NsNodeType';

export class NsBone extends NsSceneNode
{
	animations: NsAnimation[] = [];

	constructor(name = '', parent = '')
	{
		super(name, parent);
		this.nodeType = NsNodeType.Bone;
	}

	Load(reader: NsBinaryReader): boolean
	{
		if (!super.Load(reader))
			return false;

		this.version.push(reader.readSingle());

		this.animations = [];
		let animationCount = reader.readUInt32();
		for (let i = 0; i < animationCount; ++i)
		{
			let anim = new NsAnimation(reader.readString());
			if (this.version[1] >= 0.20) {
				anim.recycle = reader.readString();
			}

			if (anim.recycle.length == 0)
			{
				anim.frameCount = reader.readUInt32();

				if (reader.readByte() != 0)
				{
					const position = reader.readVector3();
					const rotation = reader.readQuaternion();
					const scale = reader.readVector3();

					const positions: any = {};
					const positionCount = reader.readUInt32();
					for (let n = 0; n < positionCount; ++n)
					{
						const frame = reader.readUInt32();
						const value = reader.readVector3();
						positions[frame] = {
							x: value.x,
							y: value.y,
							z: value.z
						};
					}

					const rotations: any = {};
					const rotationCount = reader.readUInt32();
					for (let n = 0; n < rotationCount; ++n)
					{
						const frame = reader.readUInt32();
						rotations[frame] = reader.readQuaternion();
					}

					const scales: any = {};
					const scaleCount = reader.readUInt32();
					for (let n = 0; n < scaleCount; ++n)
					{
						const frame = reader.readUInt32();
						scales[frame] = reader.readVector3();
					}

					anim.transformKeyData = new NsTransformKeyData();
					anim.transformKeyData.position = position;
					anim.transformKeyData.positions = positions;
					anim.transformKeyData.rotation = rotation;
					anim.transformKeyData.rotations = rotations;
					anim.transformKeyData.scale = scale;
					anim.transformKeyData.scales = scales;
				}

				if (reader.readUInt32() > 0)
				{
					reader.seek(-4, SeekOrigin.Current);

					const opacities: any = {};
					const opacityCount = reader.readUInt32();
					for (let n = 0; n < opacityCount; ++n)
					{
						const frame = reader.readUInt32();
						opacities[frame] = reader.readSingle();
					}

					anim.floatKeyData = new NsFloatKeyData();
					anim.floatKeyData.opacities = opacities;
				}
			}

			this.animations.push(anim);
		}

		return true;
	}

	Save(writer: NsBinaryWriter): boolean
	{
		return false;
	}
}
