import {SeekOrigin} from './SeekOrigin';
import {Matrix4, Quaternion, Vector2, Vector3, Vector4} from 'three';
import { NsMatrix4, NsQuaternion, NsVector2, NsVector3, NsVector4 } from "../Common/NsMath";

export class NsBinaryWriter
{
	handle: Buffer;
	offset: number;

	constructor(handle: Buffer)
	{
		this.handle = handle;
		this.offset = 0;
	}

	seek(offset: number, origin: SeekOrigin)
	{
		if (origin == SeekOrigin.Current)
			this.offset += offset;
		else if (origin == SeekOrigin.Begin)
			this.offset = offset;
		else if (origin == SeekOrigin.End)
			this.offset = this.handle.length + offset;
		else
			throw 'origin not found';
	}

	write(buffer: Buffer) : Buffer
	{
		this.handle = Buffer.concat([ this.handle, buffer ]);
		this.offset += buffer.length;
		return buffer;
	}

	writeByte(value: number) { let buffer = new Buffer(1); buffer.writeUInt8(value); return this.write(buffer); }
	writeInt16(value: number) { let buffer = new Buffer(2); buffer.writeUInt8(value); return this.write(buffer); }
	writeUInt16(value: number) { let buffer = new Buffer(2); buffer.writeUInt8(value); return this.write(buffer); }
	writeInt32(value: number) { let buffer = new Buffer(4); buffer.writeUInt8(value); return this.write(buffer); }
	writeUInt32(value: number) { let buffer = new Buffer(4); buffer.writeUInt8(value); return this.write(buffer); }
	writeInt64(value: bigint) { let buffer = new Buffer(8); buffer.writeBigInt64LE(value); return this.write(buffer); }
	writeUInt64(value: bigint) { let buffer = new Buffer(8); buffer.writeBigUInt64LE(value); return this.write(buffer); }
	writeSingle(value: number) { let buffer = new Buffer(4); buffer.writeFloatLE(value); return this.write(buffer); }
	writeDouble(value: number) { let buffer = new Buffer(8); buffer.writeDoubleLE(value); return this.write(buffer); }

	writeString(value: string)
	{
		let buffer = new Buffer(value.length + 1);
		buffer.write(value, 'utf8');
		buffer.write('\0');
		this.write(buffer);
	}

	writeFixedString(value: string, size: number)
	{
		let buffer = new Buffer(size);
		buffer.fill(0);
		buffer.write(value, 'utf8');
		this.write(buffer);
	}

	writeVector2(value: NsVector2)
	{
		let buffer = new Buffer(8);
		buffer.writeFloatLE(value.x);
		buffer.writeFloatLE(value.y);
		this.write(buffer);
	}

	writeVector3(value: NsVector3)
	{
		let buffer = new Buffer(12);
		buffer.writeFloatLE(value.x);
		buffer.writeFloatLE(value.y);
		buffer.writeFloatLE(value.z);
		this.write(buffer);
	}

	writeVector4(value: NsVector4)
	{
		let buffer = new Buffer(16);
		buffer.writeFloatLE(value.x);
		buffer.writeFloatLE(value.y);
		buffer.writeFloatLE(value.z);
		buffer.writeFloatLE(value.w);
		this.write(buffer);
	}

	writeQuaternion(value: NsQuaternion)
	{
		let buffer = new Buffer(16);
		buffer.writeFloatLE(value.x);
		buffer.writeFloatLE(value.y);
		buffer.writeFloatLE(value.z);
		buffer.writeFloatLE(value.w);
		this.write(buffer);
	}

	writeMatrix4(value: NsMatrix4)
	{
		let buffer = new Buffer(64);
		buffer.writeFloatLE(value.m00);
		buffer.writeFloatLE(value.m01);
		buffer.writeFloatLE(value.m02);
		buffer.writeFloatLE(value.m03);
		buffer.writeFloatLE(value.m10);
		buffer.writeFloatLE(value.m11);
		buffer.writeFloatLE(value.m12);
		buffer.writeFloatLE(value.m13);
		buffer.writeFloatLE(value.m20);
		buffer.writeFloatLE(value.m21);
		buffer.writeFloatLE(value.m22);
		buffer.writeFloatLE(value.m23);
		buffer.writeFloatLE(value.m30);
		buffer.writeFloatLE(value.m31);
		buffer.writeFloatLE(value.m32);
		buffer.writeFloatLE(value.m33);
		this.write(buffer);
	}
}