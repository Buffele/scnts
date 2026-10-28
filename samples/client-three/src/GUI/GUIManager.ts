// @ts-nocheck

import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import './deps/imgui.umd.js';
import './deps/imgui_impl.umd.js';
/*
import { ImGui, ImGui_Impl } from '@zhobo63/imgui-ts';
import { ImGuiCol, ImGuiTreeNodeFlags } from '@zhobo63/imgui-ts/src/imgui';
*/

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Renderer } from '../Renderer/Renderer';
import { ImControls } from './ImControls';
import { ResourceClient } from '../Utility/ResourceClient';
import { App } from '../App/App';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

await ImGui.default();

export class GUIManager
{
	renderer: Renderer;
	scene: THREE.Scene;

	controls: any;
	statistics: Stats;

	activeObject: THREE.Object3D | null = null;
	bginfos: string[] = [];

	constructor(renderer: Renderer, scene: THREE.Scene)
	{
		this.renderer = renderer;
		this.scene = scene;

		this.controls = new OrbitControls(this.renderer.camera, this.renderer.webgl.domElement)
		//this.controls = new PointerLockControls(this.renderer.camera, this.renderer.webgl.domElement);

		this.statistics = Stats();
		document.body.appendChild(this.statistics.dom);

		ImGui.CreateContext();
		ImGui.StyleColorsDark();

		ImGui.GetIO().ConfigWindowsMoveFromTitleBarOnly = true;

		const imguiCanvas = document.getElementById('canvas-imgui');
		if (imguiCanvas !== null) {
			imguiCanvas.addEventListener = (name: string, event: any) => {
				if (name.startsWith('key')) {
					window.addEventListener(name, event);
				}
				else {
					this.renderer.canvas.addEventListener(name, event);
				}
			};

			ImGui_Impl.Init(imguiCanvas);
			imguiCanvas.style.pointerEvents = 'none';
		}


		this.Init();
	}

	async Init() {
		this.bginfos = [];
		this.bginfos = (await ResourceClient.GetBGInfos()).results;
	}

	Update(time: number)
	{
		ImGui_Impl.NewFrame(time);
		ImGui.NewFrame();

		ImGui.SetNextWindowPos(new ImGui.ImVec2(20, 20), ImGui.Cond.FirstUseEver);
		ImGui.SetNextWindowSize(new ImGui.ImVec2(294, 140), ImGui.Cond.FirstUseEver);
		ImGui.Begin('Hierarchy');
		{
			for (const object of this.scene.children) {
				this.DrawHierarchy(object);
			}
		}
		ImGui.End();

		ImGui.Begin('Inspector');
		{
			if (this.activeObject != null) {
				this.DrawInspector(this.activeObject);
			}
		}
		ImGui.End();

		ImGui.Begin('Map Loader');
		{
			if (this.bginfos && this.bginfos.length > 0)
			{
				for (const bginfo of this.bginfos)
				{
					if (ImGui.Button(bginfo))
					{
						(async () => {
							this.scene.clear();
							localStorage.setItem('item', bginfo);
							const json = await ResourceClient.LoadBGInfo(bginfo);
							await App.Instance.LoadFromJson(json);
						})();
					}
				}
			}
		}
		ImGui.End();

		ImGui.EndFrame();
		ImGui.Render();

		this.statistics.update();

		if (this.controls instanceof OrbitControls) {
			this.controls.enabled = !ImGui.GetIO().WantCaptureMouse;
			this.controls.update();
		}
	}

	Render()
	{
		ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
	}

	Destroy()
	{
		ImGui_Impl.Shutdown();
		ImGui.DestroyContext();
	}

	DrawHierarchy(object: THREE.Object3D)
	{
		if (object.name === '') {
			return;
		}

		const childCount = object.children.length;
		const treeFlags = ImGui.ImGuiTreeNodeFlags.FramePadding |
			ImGui.ImGuiTreeNodeFlags.OpenOnArrow |
			ImGui.ImGuiTreeNodeFlags.SpanAvailWidth |
			(childCount == 0 ? ImGui.ImGuiTreeNodeFlags.Leaf : 0) |
			(object == this.activeObject ? ImGui.ImGuiTreeNodeFlags.Selected : 0);

		const active = object.visible;
		if (!active)
			ImGui.PushStyleColor(ImGui.ImGuiCol.Text, new ImGui.ImVec4(0.35, 0.35, 0.35, 1.0));

		const isOpen = ImGui.TreeNodeEx(object.name, treeFlags);
		if (ImGui.IsItemClicked()) {
			this.activeObject = object;
		}

		if (isOpen)
		{
			for (const child of object.children) {
				this.DrawHierarchy(child);
			}

			ImGui.TreePop();
		}

		if (!active)
			ImGui.PopStyleColor();
	}

	DrawInspector(object: THREE.Object3D)
	{
		ImGui.Checkbox('##IsActive', (value: boolean = object.visible as boolean) => object.visible = value);
		ImGui.SameLine();

		ImGui.PushItemWidth(ImGui.GetContentRegionAvail().x);
		ImGui.InputText('##Name', (value: string = object.name as string) => object.name = value, ImGui.ImGuiInputTextFlags.EnterReturnsTrue);

		ImGui.PopItemWidth();

		ImGui.Spacing();
		ImGui.Separator();
		ImGui.Spacing();

		if (ImGui.TreeNodeEx('Transform', ImGui.ImGuiTreeNodeFlags.DefaultOpen))
		{
			const rotationQuaternion = new THREE.Quaternion();
			rotationQuaternion.setFromEuler(object.rotation);
			if (ImControls.Transform(object.position, rotationQuaternion, object.scale)) {
				object.rotation.setFromQuaternion(rotationQuaternion);
			}

			ImGui.TreePop();
		}

		if (object instanceof THREE.Mesh)
		{
			const mesh = <THREE.Mesh> object;
			if (ImGui.TreeNodeEx('Materials', ImGui.ImGuiTreeNodeFlags.DefaultOpen))
			{
				let n = 0;
				// @ts-ignore
				for (const material of mesh.material)
				{
					if (ImGui.TreeNodeEx(`[${n++}]`, ImGui.ImGuiTreeNodeFlags.DefaultOpen))
					{
						if (material.uniforms['g_TexDiffuse'] != undefined) {
							const diffuse = material.uniforms['g_TexDiffuse'].value;
							ImGui.Text('Diffuse: ' + diffuse.name);
						}

						ImGui.SliderFloat('Opacity', (_:number=material.uniforms.opacity.value as number):number=>material.uniforms.opacity.value=_, 0.0, 1.0, '%.2f');
						ImGui.TreePop();
					}
				}

				ImGui.TreePop();
			}
		}

		if (object.animator !== undefined)
		{
			if (ImGui.TreeNodeEx("Animator", ImGui.ImGuiTreeNodeFlags.DefaultOpen))
			{
				const animator = <Animator> object.animator;

				if (animator.activeAnimName !== "") {
					ImGui.SliderFloat("Current Time", (_:number=animator.currentTime as number):number=>animator.currentTime=_, 0.0, animator.GetFrameCount() / 80.0 / 60.0, "%.2f");
					ImGui.SliderFloat("Playback Speed", (_:number=animator.playbackSpeed as number):number=>animator.playbackSpeed=_, 0.0, 10.0, "%.2f");
				}

				if (ImGui.TreeNodeEx("Animations", ImGui.ImGuiTreeNodeFlags.DefaultOpen))
				{
					const animations = animator.GetAnimationNames();
					for (const animName of animations)
					{
						if (ImGui.TreeNodeEx(animName))
						{
							if (animName == animator.activeAnimName)
							{
								if (animator.isPlaying)
								{
									if (ImGui.Button("Pause")) {
										animator.isPlaying = false;
									}
								}
								else
								{
									if (ImGui.Button("Resume")) {
										animator.isPlaying = true;
									}
								}
							}
							else
							{
								if (ImGui.Button("Play")) {
									animator.Play(animName, 0.2);
								}
							}

							ImGui.TreePop();
						}
					}

					ImGui.TreePop();
				}

				ImGui.TreePop();
			}
		}

		ImGui.Spacing();
		ImGui.Separator();
		ImGui.Spacing();

		ImGui.Text("Log to console");
		ImGui.SameLine();
		if (ImGui.Button("three.js")) {
			console.log(this.activeObject);
		}
		ImGui.SameLine();
		if (ImGui.Button(".scn")) {
			console.log(this.activeObject.sceneNode);
		}
	}

//	PopulateGUI(object: THREE.Object3D)
//	{
//		return this.PopulateObjectGUI(this.gui, object);
//	}
//
//	PopulateObjectGUI(ui: any, object: THREE.Object3D)
//	{
//		if (object.name === '') {
//			return;
//		}
//
//		this.config[object.id] = {
//			'Visible': true,
//			'Transform': {
//				'Position': {
//					x: object.position.x,
//					y: object.position.y,
//					z: object.position.z,
//				},
//				'Rotation': {
//					x: object.rotation.x,
//					y: object.rotation.y,
//					z: object.rotation.z,
//				},
//				'Scale': {
//					x: object.scale.x,
//					y: object.scale.y,
//					z: object.scale.z,
//				}
//			}
//		};
//
//		const folder = ui.addFolder(object.name);
//		folder.add(this.config[object.id], 'Visible').onChange(this.OnConfigChange.bind(this, object));
//		folder.close();
//
//		const transform = folder.addFolder('Transform');
//		const position = transform.addFolder('Position');
//		position.add(this.config[object.id]['Transform']['Position'], 'x').onChange(this.OnConfigChange.bind(this, object));
//		position.add(this.config[object.id]['Transform']['Position'], 'y').onChange(this.OnConfigChange.bind(this, object));
//		position.add(this.config[object.id]['Transform']['Position'], 'z').onChange(this.OnConfigChange.bind(this, object));
//		position.close();
//
//		const rotation = transform.addFolder('Rotation');
//		rotation.add(this.config[object.id]['Transform']['Rotation'], 'x').onChange(this.OnConfigChange.bind(this, object));
//		rotation.add(this.config[object.id]['Transform']['Rotation'], 'y').onChange(this.OnConfigChange.bind(this, object));
//		rotation.add(this.config[object.id]['Transform']['Rotation'], 'z').onChange(this.OnConfigChange.bind(this, object));
//		rotation.close();
//
//		const scale = transform.addFolder('Scale');
//		scale.add(this.config[object.id]['Transform']['Scale'], 'x').onChange(this.OnConfigChange.bind(this, object));
//		scale.add(this.config[object.id]['Transform']['Scale'], 'y').onChange(this.OnConfigChange.bind(this, object));
//		scale.add(this.config[object.id]['Transform']['Scale'], 'z').onChange(this.OnConfigChange.bind(this, object));
//		scale.close();
//
//		/*
//		if (object.type === 'Mesh') {
//			const matFolderGroup = folder.addFolder('Materials');
//			matFolderGroup.close();
//
//			for (const mat of object.material) {
//				configuration[mat.id] = {
//					visible: true,
//				};
//
//				const matFolder = matFolderGroup.addFolder(mat.id + ':' + mat.name);
//				matFolder.add(configuration[object.id], 'visible').onChange(onConfigurationChange);
//				matFolder.close();
//			}
//		}
//		*/
//
//		const children = folder.addFolder('Children');
//		for (const child of object.children) {
//			this.PopulateObjectGUI(children, child);
//		}
//	}
//
//	OnConfigChange(object: THREE.Object3D)
//	{
//		const config = this.config[object.id];
//		object.visible = config['Visible'];
//		object.position.x = config['Transform']['Position'].x;
//		object.position.y = config['Transform']['Position'].y;
//		object.position.z = config['Transform']['Position'].z;
//		object.rotation.x = config['Transform']['Rotation'].x;
//		object.rotation.y = config['Transform']['Rotation'].y;
//		object.rotation.z = config['Transform']['Rotation'].z;
//		object.scale.x = config['Transform']['Scale'].x;
//		object.scale.y = config['Transform']['Scale'].y;
//		object.scale.z = config['Transform']['Scale'].z;
//	}
}