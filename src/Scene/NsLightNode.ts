import { NsSceneNode } from './NsSceneNode';
import { NsLightType } from './Constants/NsLightType';
import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsColor } from '../Common/NsColor';
import { NsNodeType } from './Constants/NsNodeType';
import { NsVector3 } from "../Common/NsMath";

export class NsLightNode extends NsSceneNode {
	lightType: NsLightType = NsLightType.Direct;
	diffuse: NsColor = new NsColor();
	specular: NsColor = new NsColor();
	ambient: NsColor = new NsColor();
	direction: NsVector3 = new NsVector3(0, 0, 0);
	range: number = 0;
	falloff: number = 0;
	attenuation0: number = 0;
	attenuation1: number = 0;
	attenuation2: number = 0;
	theta: number = 0;
	phi: number = 0;

	constructor(name: string = '', parent: string = '') {
		super(name, parent);
		this.nodeType = NsNodeType.LightNode;
	}

	Load(reader: NsBinaryReader): boolean {
		if (!super.Load(reader)) {
			return false;
		}

		this.version[1] = reader.readSingle();
		if (this.version[1] < 0.10) {
			return false;
		}

		if (this.version[1] >= 0.3) {
			/*
			 * 	Xero import hack, used for Jungle and Station-2 at the moment.
			 */
			return this.LoadConfused(reader);
		}

		this.lightType = reader.readUInt32();
		this.diffuse = reader.readColor();
		this.specular = reader.readColor();
		this.ambient = reader.readColor();
		this.direction = reader.readVector3();
		this.range = reader.readSingle();
		this.falloff = reader.readSingle();
		this.attenuation0 = reader.readSingle();
		this.attenuation1 = reader.readSingle();
		this.attenuation2 = reader.readSingle();
		this.theta = reader.readSingle();
		this.phi = reader.readSingle();

		return true;
	}

	/*
	 * 	Xero import hack, used for Jungle and Station-2 at the moment.
	 */
	LoadConfused(reader: NsBinaryReader): boolean {
		this.falloff = reader.readSingle();
		this.diffuse = reader.readColor();
		this.phi = reader.readSingle();
		this.specular = reader.readColor();
		this.ambient = reader.readColor();
		this.lightType = reader.readUInt32();
		this.theta = reader.readSingle();
		this.attenuation2 = reader.readSingle();
		this.range = reader.readSingle();
		this.attenuation1 = reader.readSingle();
		this.attenuation0 = reader.readSingle();
		this.direction = reader.readVector3();

		return true;
	}

	Save(writer: NsBinaryWriter): boolean {
		return false;
	}
}