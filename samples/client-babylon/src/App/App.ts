import * as BABYLON from '@babylonjs/core';
import '@babylonjs/inspector';
import {Renderer} from "../Renderer/Renderer";
import {SceneImporter} from "../Utility/SceneImporter";

export class App
{
	static Instance: App;
	renderer: Renderer;
	scene: BABYLON.Scene | null = null;
	camera: BABYLON.ArcRotateCamera | null = null;

	constructor()
	{
		App.Instance = this;
		this.renderer = new Renderer();
		this.renderer.engine.runRenderLoop(() => {
			this.Run();
		});

		this.InitializeStage();
	}

	InitializeStage()
	{
		if (this.scene) {
			this.scene.dispose();
		}

		this.scene = new BABYLON.Scene(this.renderer.engine);
		this.scene.debugLayer.show({
			overlay: true,
			showExplorer: true,
			showInspector: true
		});

		//new BABYLON.DirectionalLight('light', new BABYLON.Vector3(1, 1, 0), this.scene);
		const light = new BABYLON.HemisphericLight('light', BABYLON.Vector3.Zero(), this.scene);
		light.groundColor = new BABYLON.Color3(1, 1, 1);

		this.camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 15, new BABYLON.Vector3(0, 0, 0));
		this.camera.inertia = 0;
		//this.camera.panningAxis = new BABYLON.Vector3(0, 1, 0);

		this.camera.attachControl(this.renderer.canvas, true);
		this.camera.wheelPrecision = 1;
	}

	async LoadFromJson(json: any) {
		if (!this.scene) {
			return;
		}

		for (const result of json) {
			const scn = result.scene;

			// await TextureLoader.preload(scn, result.assets);

			let filename = scn.filePath.substring(scn.filePath.lastIndexOf('/') + 1);
			console.log(`Loading ${filename}...`)

			const importer = new SceneImporter(this.scene, scn);
			await importer.run();

			// this.animators = this.animators.concat(importer.animators);
		}
	}

	Run() {
		if (!this.scene) {
			return;
		}

		this.scene.render();
	}
}