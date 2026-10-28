import { NsMatrix4 } from "../Common/NsMath";

export class NsWeightData
{
	bone = '';
	bindpose: NsMatrix4 = new NsMatrix4();
	weights: Map<number, number> = new Map();

	toJSON() {
		return { bone: this.bone, bindpose: this.bindpose, weights: Object.fromEntries(this.weights) };
	}
}
