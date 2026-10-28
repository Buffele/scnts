import { NsScene } from './src/Scene/NsScene';

/*let dir = "G:/Old Projects/Pentavision/Xero/Misc/S7_ResourcesClean/resources/resources/model";
glob(dir + "/!**!/!*.scn", (err, matches) => {
	let count = matches.length;
	let i = 1;
	matches.forEach(path => {
		let scene = NsScene.LoadFromFile(path);
		if (scene == null) {
			throw 'failed to load scene';
		}

		let jsonPath = path.substring(0, path.lastIndexOf(".scn")) + ".json";
		fs.writeFileSync(jsonPath, JSON.stringify(scene, null, '\t'));

		console.log(`'${jsonPath}' written (${i++}/${count}).`)
	});
});*/

const path = 'G:/Old Projects/Pentavision/Xero/Misc/S7_ResourcesClean/resources/resources/model/background/ds5_station.scn';
const scene = NsScene.LoadFromFile(path);
if (scene == null) {
	throw 'failed to load scene';
}

const assetNames = scene.GetAssetNames();
//const assetData = scene.GetAssetData();

console.log(assetNames);
//console.log(assetData);