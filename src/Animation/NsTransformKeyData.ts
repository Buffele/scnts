import { NsQuaternion, NsVector3 } from "../Common/NsMath";

export class NsTransformKeyData
{
	position: NsVector3 = new NsVector3();
	positions: any = {};
	rotation: NsQuaternion = new NsQuaternion();
	rotations: any = {};
	scale: NsVector3 = new NsVector3(1, 1, 1);
	scales: any = {};
}