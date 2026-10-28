import * as BABYLON from "@babylonjs/core";
import { DDSTools } from "@babylonjs/core";

export class Renderer
{
	engine: BABYLON.Engine;
	canvas: HTMLCanvasElement;

	static Instance: Renderer;

	constructor()
	{
		Renderer.Instance = this;

		this.canvas = <HTMLCanvasElement> document.getElementById('renderCanvas');
		this.engine = new BABYLON.Engine(this.canvas, true, {}, true);

		// @ts-ignore
		this.engine._unpackFlipY = function(value)
		{
			// @ts-ignore
			if (this._unpackFlipYCached !== 0) {
				// @ts-ignore
				this._gl.pixelStorei(this._gl.UNPACK_FLIP_Y_WEBGL, 0);
				// @ts-ignore
				if (this.enableUnpackFlipYCached) {
					// @ts-ignore
					this._unpackFlipYCached = 0;
				}
			}
		};

		const orig_func = this.engine._uploadDataToTextureDirectly;
		this.engine._uploadDataToTextureDirectly = function(
		         texture: BABYLON.InternalTexture,
		         imageData: ArrayBufferView,
		         faceIndex: number = 0,
		         lod: number = 0,
		         babylonInternalFormat?: number,
		         useTextureWidthAndHeight = false
		     ): void
		{
			orig_func.bind(this)(texture, imageData, faceIndex, lod, babylonInternalFormat, true);
		};

		// @ts-ignore
		DDSTools._ExtractLongWordOrder = function(value: number): number
		{
			if (value === 0 || value === 255) {
				return 0;
			} else if (value === 65280) {
				return 1;
			} else if (value === 16711680) {
				return 2;
			} else if (value === -16777216) {
				return 3;
			} else {
				throw "Failed to extract order";
			}
		};

		window.addEventListener('resize', () => {
			this.engine.resize();
		});
	}
}