import { NsBinaryReader } from '../IO/NsBinaryReader';
import { NsBinaryWriter } from '../IO/NsBinaryWriter';
import { NsNodeType } from './Constants/NsNodeType';
import { NsMatrix4 } from "../Common/NsMath";

export class NsSceneNode
{
    name: string;
    parent: string;
    matrix: NsMatrix4 = new NsMatrix4();
    version: number[] = [];
    nodeType: NsNodeType = NsNodeType.None;

    constructor(name: string, parent: string)
    {
        this.name = name;
        this.parent = parent;
    }

    Load(reader: NsBinaryReader): boolean
    {
        this.name = reader.readString();
        this.parent = reader.readString();
        this.version = [reader.readSingle()];
        this.matrix = reader.readMatrix4();
        return true;
    }

    Save(writer: NsBinaryWriter): boolean
    {
        writer.writeString(this.name);
        writer.writeString(this.parent);
        writer.writeSingle(this.version[0]);
        writer.writeMatrix4(this.matrix);
        return true;
    }

    GetAssetNames(): string[]
    {
        return [];
    }
}
