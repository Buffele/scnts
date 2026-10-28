import * as THREE from "three";
import { ColorRepresentation } from "three";

export class Renderer
{
	webgl: THREE.WebGLRenderer;
	camera: THREE.PerspectiveCamera;
	renderTarget: THREE.WebGLRenderTarget;
	canvas: HTMLCanvasElement;

	static Instance: Renderer;

	constructor()
	{
		Renderer.Instance = this;

		// THREE.Object3D.DefaultUp.set(0, 0, 1);

		this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.3, 15000.0);
		this.renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { format: THREE.RGBAFormat });

		this.webgl = new THREE.WebGLRenderer({
			antialias: true,
			canvas: <HTMLCanvasElement> document.getElementById('canvas-three.js'),
		});

		this.webgl.setPixelRatio(window.devicePixelRatio);
		this.webgl.setViewport(0, 0, window.innerWidth, window.innerHeight);
		this.webgl.setSize(window.innerWidth, window.innerHeight);
		//document.body.appendChild(this.webgl.domElement);

		this.canvas = <HTMLCanvasElement> this.webgl.getContext().canvas;
	}

	Resize(width: number, height: number)
	{
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.webgl.setSize(window.innerWidth, window.innerHeight);
	}

	Clear(clearColor: ColorRepresentation = 'rgb(16, 16, 16)', alpha?: number)
	{
		this.webgl.setClearColor(clearColor, alpha);
	}

	Render(scene: THREE.Scene)
	{
		const defaultTarget = this.webgl.getRenderTarget();

		this.webgl.setRenderTarget(this.renderTarget);
		this.webgl.render(scene, this.camera);

		this.webgl.setRenderTarget(defaultTarget);
		this.webgl.render(scene, this.camera);
	}
}