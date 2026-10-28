import config from './config';
import { NsScene } from '../../src/Scene/NsScene';
import { NsNodeType } from '../../src/Scene/Constants/NsNodeType';
import { NsSceneGroup } from '../../src/Scene/NsSceneGroup';
import { NsSceneNode } from '../../src/Scene/NsSceneNode';
import { NsBone } from '../../src/Scene/NsBone';
import { NsShapeNode } from '../../src/Scene/NsShapeNode';
import { NsGeometry } from '../../src/Scene/NsGeometry';
import { NsLightNode } from '../../src/Scene/NsLightNode';
import { NsBoxNode } from '../../src/Scene/NsBoxNode';
import glob from 'fast-glob';
import { NsBoneSystem } from '../../src/Scene/NsBoneSystem';
import { NsSphereNode } from '../../src/Scene/NsSphereNode';

const validateBone = (node: NsBone): void => {

}

const validateGeometry = (node: NsGeometry): void => {
	if (node.vertices.length !== node.normals.length) {
		console.log('[ERR!] Invalid Vertices and Normals count found!');
		console.log(`Vertices: ${node.vertices.length} Normals: ${node.normals.length}`);
	}
}

const validateShapeNode = (node: NsShapeNode): void => {

}

const validateBoxNode = (node: NsBoxNode): void => {

}

const validateLightNode = (node: NsLightNode): void => {

}

const validateBoneSystem = (node: NsBoneSystem): void => {

}

const validateSphereNode = (node: NsSphereNode): void => {

}

const validateSceneNode = (node: NsSceneNode): void => {
	//console.log(NsNodeType[node.nodeType]);

	if (node.nodeType === NsNodeType.SceneGroup) {
		validateSceneGroup(node as NsSceneGroup);
	} else if (node.nodeType === NsNodeType.Bone) {
		validateBone(node as NsBone);
	} else if (node.nodeType === NsNodeType.Geometry) {
		validateGeometry(node as NsGeometry);
	} else if (node.nodeType === NsNodeType.ShapeNode) {
		validateShapeNode(node as NsShapeNode);
	} else if (node.nodeType === NsNodeType.BoxNode) {
		validateBoxNode(node as NsBoxNode);
	} else if (node.nodeType === NsNodeType.LightNode) {
		validateLightNode(node as NsLightNode);
	} else if (node.nodeType === NsNodeType.BoneSystem) {
		validateBoneSystem(node as NsBoneSystem);
	} else if (node.nodeType === NsNodeType.SphereNode) {
		validateSphereNode(node as NsSphereNode);
	} else {
		console.log(`Invalid nodeType found! ${NsNodeType[node.nodeType]}:${node.nodeType}`)
	}
}

const validateSceneGroup = (scene: NsSceneGroup): void => {
	for (const node of scene.nodes) {
		validateSceneNode(node);
	}
}

const validateScn = (scene: NsScene): void => {
	for (const node of scene.nodes) {
		validateSceneNode(node);
	}
}

const start = async (): Promise<void> => {
	const matches1 = await glob(`${config.path}/model/**/*.scn`);
	// const path = config.path + '/model/background/ds5_station.scn';
	// const path = config.path + '/model/weapon/sword.scn';
	// const matches1 = [`${config.path}/model/character/acc/120_female_leg.scn`];
	// const matches1 = [`${config.path}/model/character/leg/120_female_leg.scn`];

	let i = 0;

	for (const match of matches1) {
		i++;

		console.log(`Loading ${match}... (${i} / ${matches1.length})`);

		try {
			const scene = NsScene.LoadFromFile(match);
			if (scene == null) {
				console.log('[ERR!] Failed to load scene');
				continue;
			}

			validateScn(scene);
		} catch (e) {
			console.log('[ERR!]');
			console.log(e);
		}
	}
}

start();