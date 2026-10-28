import { App } from './App/App';
import { ResourceClient } from './Utility/ResourceClient';

const app = new App();

let json: any;

const item = localStorage.getItem('item');
if (item) {
	json = await ResourceClient.LoadBGInfo(item);
} else {
	json = await ResourceClient.LoadScenes([
		//'model/background/sky_bluesky.scn',
		//'model/weapon/taserplasma.scn',
		'model/weapon/sword.scn',
	]);
}
console.log(item);

await app.LoadFromJson(json);
await app.Run();