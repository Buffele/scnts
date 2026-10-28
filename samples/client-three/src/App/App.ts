import * as THREE from "three";
import { Renderer } from "../Renderer/Renderer";
import { GUIManager } from "../GUI/GUIManager";
import { SceneImporter } from "../Utility/SceneImporter";
import { GetViewDistance } from "../Utility/SceneUtility";
import { Animator } from "../Scene/Animator";
import {TextureLoader} from "../Utility/TextureLoader";

export class App
{
	scene: THREE.Scene;
	renderer: Renderer;
	guiManager: GUIManager;
	animators: Animator[] = [];
	clock: THREE.Clock;

	prevTime: number = 0.0;
	currentTime: number = 0.0;

	static Instance: App;

	constructor()
	{
		App.Instance = this;
		this.scene = new THREE.Scene();
		this.renderer = new Renderer();
		this.guiManager = new GUIManager(this.renderer, this.scene);
		this.clock = new THREE.Clock();
	}

	async LoadFromJson(json: any)
	{
		for (const result of json)
		{
			const scn = result.scene;

			await TextureLoader.preload(scn, result.assets);

			let filename = scn.filePath.substring(scn.filePath.lastIndexOf('/') + 1);
			console.log(`Loading ${filename}...`)

			const importer = new SceneImporter(this.scene, scn);
			await importer.run();

			this.animators = this.animators.concat(importer.animators);
			//for (const topObject of importer.topObjects) {
			//guiManager.PopulateGUI(topObject);
			//}
		}

		const viewDistance = GetViewDistance(this.scene);
		this.renderer.camera.position.y = -viewDistance;
		this.renderer.camera.position.z = viewDistance;
	}

	async Run()
	{
		const loop = async (time: number) => {
			await this.Update(time);
			window.requestAnimationFrame(loop);
		};

		window.addEventListener('resize', this.OnResize.bind(this), false)

		window.requestAnimationFrame(loop);
	}

	async Update(time: number)
	{
		this.prevTime = this.currentTime;
		this.currentTime = time;

		const delta = this.clock.getDelta();

		await this.guiManager.Update(time);

		for (const animator of this.animators) {
			animator.Update(delta);
		}

		this.renderer.Clear('rgb(16, 16, 16)', 1.0);
		this.renderer.Render(this.scene);

		this.guiManager.Render();

		this.renderer.webgl.state.reset();
	}

	OnResize()
	{
		this.renderer.Resize(window.innerWidth, window.innerHeight);
		this.renderer.Render(this.scene);
	}
}