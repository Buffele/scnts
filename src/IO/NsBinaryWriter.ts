import { SeekOrigin } from './SeekOrigin';
import { encode, decode } from 'iconv-lite';
import { NsMatrix4, NsQuaternion, NsVector2, NsVector3, NsVector4 } from '../Common/NsMath';

export class NsBinaryWriter {
    offset = 0;
    constructor(public handle: Buffer = Buffer.alloc(0)) {}

    seek(offset: number, origin: SeekOrigin) {
        const base = origin === SeekOrigin.Begin ? 0 : origin === SeekOrigin.Current ? this.offset :
            origin === SeekOrigin.End ? this.handle.length : NaN;
        const next = base + offset;
        if (!Number.isSafeInteger(next) || next < 0) throw new RangeError('Invalid binary write offset');
        this.offset = next;
    }

    write(buffer: Buffer): Buffer {
        const end = this.offset + buffer.length;
        if (end > this.handle.length) {
            const expanded = Buffer.alloc(end);
            this.handle.copy(expanded);
            this.handle = expanded;
        }
        buffer.copy(this.handle, this.offset);
        this.offset = end;
        return buffer;
    }

    private scalar(size: number, fill: (buffer: Buffer) => void): Buffer {
        const buffer = Buffer.alloc(size);
        fill(buffer);
        return this.write(buffer);
    }
    writeByte(value: number) { return this.scalar(1, b => b.writeUInt8(value)); }
    writeInt16(value: number) { return this.scalar(2, b => b.writeInt16LE(value)); }
    writeUInt16(value: number) { return this.scalar(2, b => b.writeUInt16LE(value)); }
    writeInt32(value: number) { return this.scalar(4, b => b.writeInt32LE(value)); }
    writeUInt32(value: number) { return this.scalar(4, b => b.writeUInt32LE(value)); }
    writeInt64(value: bigint) { return this.scalar(8, b => b.writeBigInt64LE(value)); }
    writeUInt64(value: bigint) { return this.scalar(8, b => b.writeBigUInt64LE(value)); }
    writeSingle(value: number) { return this.scalar(4, b => b.writeFloatLE(value)); }
    writeDouble(value: number) { return this.scalar(8, b => b.writeDoubleLE(value)); }

    private stringBytes(value: string): Buffer {
        if (value.includes('\0')) throw new Error('SCN strings cannot contain NUL');
        // The reader uses the Windows EUC-KR repertoire (CP949).
        const bytes = encode(value, 'cp949');
        if (decode(bytes, 'cp949') !== value) throw new Error('String cannot be encoded as EUC-KR');
        return bytes;
    }
    writeString(value: string) {
        this.write(Buffer.concat([this.stringBytes(value), Buffer.from([0])]));
    }
    writeFixedString(value: string, size: number) {
        if (!Number.isSafeInteger(size) || size < 0) throw new RangeError('Invalid fixed string size');
        const bytes = this.stringBytes(value);
        if (bytes.length > size) throw new RangeError('String exceeds fixed field size');
        const buffer = Buffer.alloc(size);
        bytes.copy(buffer);
        this.write(buffer);
    }
    writeVector2(value: NsVector2) { this.writeSingle(value.x); this.writeSingle(value.y); }
    writeVector3(value: NsVector3) { this.writeVector2(value); this.writeSingle(value.z); }
    writeVector4(value: NsVector4) { this.writeVector3(value); this.writeSingle(value.w); }
    writeQuaternion(value: NsQuaternion) { this.writeVector4(value); }
    writeMatrix4(value: NsMatrix4) {
        for (const row of ['0', '1', '2', '3']) {
            for (const column of ['0', '1', '2', '3']) {
                this.writeSingle(value[`m${row}${column}` as keyof NsMatrix4]);
            }
        }
    }
}
