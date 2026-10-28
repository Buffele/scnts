import { App } from './App/App';
import { ResourceClient } from './Utility/ResourceClient';

const app = new App();

let json: any;

// @ts-ignore
window.load_bg = async (value) => {
	app.InitializeStage();
	console.log(`Loading ${value}...`);
	await app.LoadFromJson(await ResourceClient.LoadBGInfo(value));
	console.log('Loading finished.');
};

// @ts-ignore
window.get_bginfos = async () => {
	const url = new URL('http://127.0.0.1:4444');
	url.pathname = '/scn/get-bginfo-filenames';
	const response = await fetch(url);
	return await response.json();
}

json = await ResourceClient.LoadBGInfo('bginfo-station-2.ini');
//json = await ResourceClient.LoadScenes([
//	'model/background/station2.scn',
//	'model/background/station2_sector.scn',
//    //'model/weapon/taserplasma.scn',
//    //'model/weapon/sword.scn',
//]);

await app.LoadFromJson(json);
await app.Run();