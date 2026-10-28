import { NsTransformKeyData } from './NsTransformKeyData';
import { NsFloatKeyData } from './NsFloatKeyData';
import { NsMorphKeyData } from './NsMorphKeyData';

export class NsAnimation
{
	name: string = '';
	recycle: string = '';
	frameCount: number = 0;
	transformKeyData: NsTransformKeyData = new NsTransformKeyData();
	floatKeyData: NsFloatKeyData = new NsFloatKeyData();
	morphKeyData: NsMorphKeyData = new NsMorphKeyData();

	constructor(name: string = '')
	{
		this.name = name;
	}
}