import { unpack } from 'msgpackr';

const responseType: string = 'msgpack';

export class ResourceClient
{
	static async GetBGInfos(): Promise<any> {
		const url = new URL('http://127.0.0.1:4444');
		url.pathname = '/scn/get-bginfo-filenames';
		url.searchParams.set('responseType', responseType);
		const response = await fetch(url);

		if (responseType === 'msgpack') {
			return unpack(new Uint8Array(await response.arrayBuffer()));
		}

		return await response.json();
	}

	static async LoadBGInfo(filename: string): Promise<any> {
		const url = new URL('http://127.0.0.1:4444');
		url.pathname = '/scn/bginfo';
		url.searchParams.set('filename', filename);
		url.searchParams.set('responseType', responseType);
		const response = await fetch(url);

		if (responseType === 'msgpack') {
			return unpack(new Uint8Array(await response.arrayBuffer()));
		}

		return await response.json();
	}

	static async LoadScene(path: string): Promise<any> {
		const url = new URL('http://127.0.0.1:4444');
		url.pathname = '/scn/json';
		url.searchParams.set('path', path);
		url.searchParams.set('responseType', responseType);
		const response = await fetch(url);

		if (responseType === 'msgpack') {
			return unpack(new Uint8Array(await response.arrayBuffer()));
		}

		const json = await response.json();
		return [ json ];
	}

	static async LoadScenes(paths: string[]): Promise<any> {
		let results: string[] = [];
		for (const path of paths) {
			results = results.concat(await this.LoadScene(path));
		}

		return results;
	}
}