export class NsVector2 {
	x: number = 0.0;
	y: number = 0.0;

	constructor(x: number = 0.0, y: number = 0.0)
	{
		this.x = x;
		this.y = y;
	}
}

export class NsVector3 {
	x: number = 0.0;
	y: number = 0.0;
	z: number = 0.0;

	constructor(x: number = 0.0, y: number = 0.0, z: number = 0.0)
	{
		this.x = x;
		this.y = y;
		this.z = z;
	}
}

export class NsVector4 {
	x: number = 0.0;
	y: number = 0.0;
	z: number = 0.0;
	w: number = 0.0;

	constructor(x: number = 0.0, y: number = 0.0, z: number = 0.0, w: number = 0.0)
	{
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}
}

export class NsQuaternion {
	x: number = 0.0;
	y: number = 0.0;
	z: number = 0.0;
	w: number = 1.0;

	constructor(x: number = 0.0, y: number = 0.0, z: number = 0.0, w: number = 1.0)
	{
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
	}
}

export class NsMatrix4 {
	m00: number = 1.0;
	m01: number = 0.0;
	m02: number = 0.0;
	m03: number = 0.0;

	m10: number = 0.0;
	m11: number = 1.0;
	m12: number = 0.0;
	m13: number = 0.0;

	m20: number = 0.0;
	m21: number = 0.0;
	m22: number = 1.0;
	m23: number = 0.0;

	m30: number = 0.0;
	m31: number = 0.0;
	m32: number = 0.0;
	m33: number = 1.0;
}