import { SeekOrigin } from './SeekOrigin';
import { NsColor } from '../Common/NsColor';
import fs from 'fs';
import { NsMatrix4, NsQuaternion, NsVector2, NsVector3, NsVector4 } from "../Common/NsMath";

export class NsBinaryReader
{
	handle: Buffer;
	offset: number;
	name: string = ''; // May hold file path if loaded by file

	static openFile(path: string): NsBinaryReader | null
	{
		if (!fs.existsSync(path)) {
			return null;
		}

		const buffer = fs.readFileSync(path);
		return new NsBinaryReader(buffer, path);
	}

	constructor(handle: Buffer, name: string = '')
	{
		this.handle = handle;
		this.offset = 0;
		this.name = name;
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

	read(size: number) : Buffer
	{
		const buffer = this.handle.subarray(this.offset, this.offset + size);
        this.offset += size;
        return buffer;
	}

	readByte() { return Buffer.from(this.read(1)).readUInt8(0); }
    readInt16() { return Buffer.from(this.read(2)).readInt16LE(0); }
    readUInt16() { return Buffer.from(this.read(2)).readUInt16LE(0); }
    readInt32() { return Buffer.from(this.read(4)).readInt32LE(0); }
    readUInt32() { return Buffer.from(this.read(4)).readUInt32LE(0); }
    readInt64() { return Buffer.from(this.read(8)).readBigInt64LE(0); }
    readUInt64() { return Buffer.from(this.read(8)).readBigUInt64LE(0); }
	readSingle() { return Buffer.from(this.read(4)).readFloatLE(0); }
	readDouble() { return Buffer.from(this.read(8)).readDoubleLE(0); }

	readString()
	{
		const chars: number[] = [];
		while (true)
		{
			const c = this.readByte();
			if (c == 0)
				return new TextDecoder('euc-kr').decode(new Uint8Array(chars));

			chars.push(c);
		}
	}

	readFixedString(size: number)
	{
		const bytes = this.read(size);
		const chars: number[] = [];
		for (let i = 0; i < size; ++i)
		{
			const c = bytes[i];
			if (c == 0)
				return new TextDecoder('euc-kr').decode(new Uint8Array(chars));

			chars.push(c);
		}

		return '';
	}

	readVector2()
	{
		const x = this.readSingle();
		const y = this.readSingle();
		return new NsVector2(x, y);
	}

	readVector3()
	{
		const x = this.readSingle();
		const y = this.readSingle();
		const z = this.readSingle();
		return new NsVector3(x, y, z);
	}

	readVector4()
	{
		const x = this.readSingle();
		const y = this.readSingle();
		const z = this.readSingle();
		const w = this.readSingle();
		return new NsVector4(x, y, z, w);
	}

	readQuaternion()
	{
		const x = this.readSingle();
		const y = this.readSingle();
		const z = this.readSingle();
		const w = this.readSingle();
		return new NsQuaternion(x, y, z, w);
	}

	readMatrix4()
	{
		const m = new NsMatrix4();
		m.m00 = this.readSingle();
		m.m01 = this.readSingle();
		m.m02 = this.readSingle();
		m.m03 = this.readSingle();
		m.m10 = this.readSingle();
		m.m11 = this.readSingle();
		m.m12 = this.readSingle();
		m.m13 = this.readSingle();
		m.m20 = this.readSingle();
		m.m21 = this.readSingle();
		m.m22 = this.readSingle();
		m.m23 = this.readSingle();
		m.m30 = this.readSingle();
		m.m31 = this.readSingle();
		m.m32 = this.readSingle();
		m.m33 = this.readSingle();
		return m;
	}

	readColor(): NsColor
	{
		const r = this.readSingle();
		const g = this.readSingle();
		const b = this.readSingle();
		const a = this.readSingle();
		return new NsColor(r, g, b, a);
	}
}