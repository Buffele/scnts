import {FastifyInstance} from 'fastify';
import {NsScene, TryLoadTexture, ResolveFilePath} from '../../../src/Scene/NsScene';
import path from 'path';
import ini from 'ini';
import fs from 'fs';
import glob from 'fast-glob';
import { pack } from 'msgpackr';
import config from '../config';
import { XMLParser } from 'fast-xml-parser';

enum ResponseType {
    JSON = 'json',
    Msgpack = 'msgpack',
}

interface BaseQueryString {
    responseType: ResponseType;
}

interface ResourceQueryString extends BaseQueryString {
    filename: string;
    sceneFilePath: string;
}

interface FileNameQueryString extends BaseQueryString {
    extended: boolean;
}

interface ScnBGInfoQueryString extends BaseQueryString {
    filename: string;
}

interface ScnJsonQueryString extends BaseQueryString {
    path: string;
}

// @ts-ignore
Map.prototype.toJson = function toJson() {
    return JSON.stringify(Array.from(this.entries()));
}

interface CachedDataObject {
    data: any;
}

interface ExtendedResult {
    name: string;
    previewImageUrl: string;
}

interface MapInfo {
    id: number;
    path: string;
    previewUrl: string;
}

//const cachedData: Map<string, CachedDataObject> = new Map();

export default (fastify: FastifyInstance, opts: any, done: any) => {
    let basePath = config.path;

    const mapInfos: Map<string, MapInfo> = new Map();

    const mapPath = `${basePath}/xml/map.x7`;
    const buffer = fs.readFileSync(mapPath, { encoding: 'utf8' });

    const parser = new XMLParser({
        ignoreAttributes: false,
    });
    let mapData = parser.parse(buffer);
    for (const map of mapData.maplist.map) {
        const previewUrl = `https://cdn.xero.gg/img/maps/${path.parse(map.resourse['@_previewinfo_path'] ?? '').name.toLowerCase()}.png`;

        const mapInfo: MapInfo = {
            id: parseInt(map['@_id']),
            path: map.resourse['@_bginfo_path'],
            previewUrl,
        };

        mapInfos.set(path.parse(mapInfo.path).base.toLowerCase(), mapInfo);
    }

    fastify.get<{
        Querystring: ResourceQueryString
    }>('/resource', async (request) => {
        const sceneFilePath = request.query.sceneFilePath;
        const filename = request.query.filename;

        let filenameWithoutExt = filename;
        if (filename.indexOf('.') != -1) {
            filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        }

        const directory = path.dirname(sceneFilePath);
        const absolutePath = ResolveFilePath(directory, filenameWithoutExt);

        const buffer = await TryLoadTexture(absolutePath);
        if (!buffer) {
            return new Buffer([]);
        }

        return buffer;
    });

    fastify.get<{
        Querystring: BaseQueryString,
    }>('/scn/models', async (request) => {
        const responseType = request.query.responseType ?? ResponseType.JSON;

        const payload = (await glob(`${basePath}/model/**/*.scn`)).map(entry => {
            return entry.replace(basePath, '').substring(1);
        });

        let data: any;
        switch (responseType) {
            case ResponseType.JSON:
                data = JSON.stringify(payload);
                break;
            case ResponseType.Msgpack:
                data = pack(payload);
                break;
        }

        return data;
    });

    fastify.get<{
        Querystring: FileNameQueryString,
    }>('/scn/get-bginfo-filenames', async (request) => {
        const responseType = request.query.responseType ?? ResponseType.JSON;

        //const cacheKey = `/scn/get-bginfo-filenames-${responseType}`;
        //if (cachedData.has(cacheKey)) {
        //    return cachedData.get(cacheKey)?.data;
        //}

        const matches1 = await glob(`${basePath}/mapinfo/*.ini`);
        const matches2 = await glob(`${basePath}/mapinfo/develop/*.ini`);

        let results: string[] = matches1.map((match) => path.basename(match));
        matches2.forEach((match) => results.push(`develop/${path.basename(match)}`));

        const payload: any = {
            results,
        };

        if (request.query.extended) {
            const extendedResults: ExtendedResult[] = [];

            for (const map of results) {
                const mapPath = `${basePath}/mapinfo/${map}`;

                let previewImageUrl = '';

                const mapInfo = mapInfos.get(path.parse(map).base);
                if (mapInfo) {
                    previewImageUrl = mapInfo.previewUrl;
                } else {
                    const buffer = fs.readFileSync(mapPath, { encoding: 'utf8' });
                    const bginfo = ini.parse(buffer);

                    let previewImageNamePre = bginfo['MAPINFO']?.previewImage ?? '';
                    if (previewImageNamePre === '' || !previewImageNamePre.endsWith('.tga')) {
                        previewImageNamePre = map
                            .replace('bginfo-', '')
                            .replace('_br', '')
                            .replace('_dm', '')
                            .replace('_ct', '')
                            .replace('-', '');
                    }

                    previewImageUrl = path.parse(previewImageNamePre).name.toLowerCase();
                    previewImageUrl = `https://cdn.xero.gg/img/maps/${previewImageUrl}.png`;
                }

                extendedResults.push({
                    name: map,
                    previewImageUrl,
                })
            }

            payload.extended = extendedResults;
        }

        let data: any;
        switch (responseType) {
            case ResponseType.JSON:
                data = JSON.stringify(payload);
                break;
            case ResponseType.Msgpack:
                data = pack(payload);
                break;
        }

        //cachedData.set(cacheKey, {
        //    data,
        //});

        return data;
    });

    fastify.get<{
        Querystring: ScnBGInfoQueryString
    }>('/scn/bginfo', (request) => {
        const responseType = request.query.responseType ?? ResponseType.JSON;

        //const cacheKey = `/scn/bginfo-${request.query.filename}-${responseType}`;
        //if (cachedData.has(cacheKey)) {
        //    return cachedData.get(cacheKey)?.data;
        //}

        const path = `${basePath}/mapinfo/${request.query.filename}`;
        const buffer = fs.readFileSync(path, { encoding: 'utf8' });
        const bginfo = ini.parse(buffer);

        let paths = [];
        const sections = [
            bginfo.SKY,
            bginfo.STATIC,
            bginfo.DYNAMIC,
        ];

        for (const section of sections)
        {
            if (section == undefined) {
                continue;
            }

            if (Object.keys(section).length == 0) {
                continue;
            }

            for (let i = 1;; ++i)
            {
                const filename = section['object_' + i];
                if (filename == undefined) {
                    break;
                }

                paths.push(`${basePath}/model/background/${filename}`);
            }
        }

        let results: any = [];
        for (const path of paths) {
            let scene = NsScene.LoadFromFile(path);
            if (scene == null) {
                continue;
            }

            results.push({
                scene,
                assets: scene.GetAssetNames(),
            });
        }

        let data: any;
        switch (responseType) {
            case ResponseType.JSON:
                data = JSON.stringify(results);
                break;
            case ResponseType.Msgpack:
                data = pack(results);
                break;
        }

        //cachedData.set(cacheKey, {
        //    data,
        //});

        return data;
    });

    fastify.get<{
        Querystring: ScnJsonQueryString
    }>('/scn/json', (request) => {
        const responseType = request.query.responseType ?? ResponseType.JSON;

        //const cacheKey = `/scn/json-${request.query.path}-${responseType}`;
        //if (cachedData.has(cacheKey)) {
        //    return cachedData.get(cacheKey)?.data;
        //}

        let scene = NsScene.LoadFromFile(`${basePath}/${request.query.path}`);
        if (scene == null) {
            return {};
        }

        const result = {
            scene,
            assets: scene.GetAssetNames(),
        };

        let data: any;
        switch (responseType) {
            case ResponseType.JSON:
                data = JSON.stringify(result);
                break;
            case ResponseType.Msgpack:
                data = pack(result);
                break;
        }

        //cachedData.set(cacheKey, {
        //    data,
        //});

        return data;
    });

    done();
};