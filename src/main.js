import './style.css';
import {initGui, point_scale, vertex_change, internal_vertex_change, resetVertexGui, updateVertexGui, messageToUser, hideDownloadLink} from './gui.js';
import {loadValues} from './computation.js';
import * as THREE from 'three';
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as Math from 'mathjs';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as hdf5 from 'jsfive';
import * as tf from '@tensorflow/tfjs';

export let scene, light, camera, controls;
export let model, model_vertices;
let marked_vertex, marked_vertex_index;
let canvas, renderer, raycaster;
let axes_scene;
let mouse_down = false;
let reset_vertex_flag = false;
let reset_all_flag = false;

init();
animate();

function init() {
	// init rendering
	canvas = document.querySelector('#c');
	renderer = new THREE.WebGLRenderer({canvas});
	renderer.autoClear = false;

	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100000);
	camera.position.set(0, 0, 150);

	controls = new OrbitControls(camera, canvas);
	// controls.maxDistance = 1;
	// controls.minDistance = 0.1;
	controls.update();

	scene = new THREE.Scene();
	scene.background = new THREE.Color('black');

	raycaster = new THREE.Raycaster();

	axes_scene = new THREE.Scene();
	const axes_helper = new THREE.AxesHelper(500);
	axes_scene.add(axes_helper);

	// hemisphere light
	{
		const skyColor = 0xB1E1FF;  // light blue
		const groundColor = 0xB97A20;  // brownish orange
		const intensity = 0.5;
		const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
		scene.add(light);
	}  

	// directional light
	{
		light = new THREE.DirectionalLight();
		light.position.set(0, 2, -10);
		light.intensity = 0.0;
		scene.add(light);
	}

	// ambient light
	{
		scene.add(new THREE.AmbientLight(0x404040));
	}
	
	initGui();

	// plane for reference of space
	/*{
		const planeSize = 40;

		const loader = new THREE.TextureLoader();
		const texture = loader.load('../models/checker.png');
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.magFilter = THREE.NearestFilter;
		const repeats = planeSize / 2;
		texture.repeat.set(repeats, repeats);

		const planeGeo = new THREE.PlaneBufferGeometry(planeSize, planeSize);
		const planeMat = new THREE.MeshPhongMaterial({
			map: texture,
			side: THREE.DoubleSide,
		});
		const mesh = new THREE.Mesh(planeGeo, planeMat);
		mesh.rotation.x = Math.PI * -.5;
		scene.add(mesh);
	}*/

	// testing cube
	/*{
		const cube = new THREE.Mesh(new BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({color: 0x00ff00}));

		cube.geometry.deleteAttribute('uv');  // TODO: uv and normals broken after this
		cube.geometry.deleteAttribute('normal');

		cube.geometry = BufferGeometryUtils.mergeVertices(cube.geometry);
		cube.geometry.computeVertexNormals();
		
		const position = cube.geometry.getAttribute('position');
		cube.geometry.attributes.original_position = position.clone();
		model = cube;
		console.log(model);
		scene.add(cube);
		// drawVertices(cube);
	}*/

	// obj loader
	/*{
		const objLoader = new OBJLoader();
		objLoader.load('../models/HumanBaseMesh.obj',
		// called when resource is loaded
		function ( object ) {
			// model = object.children[0];
			// model.geometry = BufferGeometryUtils.mergeVertices(model.geometry);
			// console.log(model);


			controls.target.x = model.position.x;
			controls.target.y = model.position.y + 2; // 10
			controls.target.z = model.position.z;
			controls.update();
			// scene.add(model);
		},
		// called when loading is in progresses
		function ( xhr ) {
			console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
		},
		// called when loading has errors
		function ( error ) {
			console.log('An error happened: ', error);
		});
	}*/

	document.addEventListener('mousedown', onMouseDown);
	document.addEventListener('mousemove', onMouseMove)
	document.addEventListener('mouseup', onMouseUp);
	document.getElementById("input").onchange = loadInput;
	console.log(scene);
}


function animate() {
	requestAnimationFrame(animate);
	render();
	update();
}

// rendering
function render() {
	function resizeRendererToDisplaySize(renderer) {
		const canvas = renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;
		if (needResize) {
			renderer.setSize(width, height, false);
		}
		return needResize;
	}

	if (resizeRendererToDisplaySize(renderer)) {
		const canvas = renderer.domElement;
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
	}

	// render normal scene
	renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
	renderer.clear();
	renderer.render(scene, camera);

	//render axes
	renderer.setViewport(window.innerWidth - window.innerHeight / 8, 0, window.innerHeight / 8, window.innerHeight / 8);
	renderer.render(axes_scene, camera);
}


function update() {
	// scales marked objects
	scene.children.forEach(element => {
		if (element.name == "marked vertex" || element.name.startsWith("landmark")) element.scale.setScalar(point_scale);
	});
	
	if ((vertex_change.length() > 0 || internal_vertex_change.update) && marked_vertex != undefined) {
		const current_pos = model.geometry.getAttribute('position');
		const orig_pos = model.geometry.getAttribute('original_position');
		let old_pos;
		if (internal_vertex_change.update) {	// the sliders are used
			console.log(internal_vertex_change.update + "WHY AM I HERE?");
			old_pos = orig_pos;
			vertex_change.set(internal_vertex_change.x, internal_vertex_change.y, internal_vertex_change.z);
			internal_vertex_change.update = false;
		} else {	// the mouse is used
			old_pos = current_pos;
		}

		current_pos.setXYZ(marked_vertex_index, 
			old_pos.getX(marked_vertex_index) + vertex_change.x, 
			old_pos.getY(marked_vertex_index) + vertex_change.y, 
			old_pos.getZ(marked_vertex_index) + vertex_change.z);
		marked_vertex.position.set(old_pos.getX(marked_vertex_index) + vertex_change.x,
			old_pos.getY(marked_vertex_index) + vertex_change.y, old_pos.getZ(marked_vertex_index) + vertex_change.z);

		vertex_change.set(0, 0, 0);
		updateModelGeometry(current_pos);
	}
	if (reset_vertex_flag) {
		const current_pos = model.geometry.getAttribute('position');
		const orig_pos = model.geometry.getAttribute('original_position');
		current_pos.setXYZ(marked_vertex_index, orig_pos.getX(marked_vertex_index),
			orig_pos.getY(marked_vertex_index), orig_pos.getZ(marked_vertex_index));
		marked_vertex.position.set(orig_pos.getX(marked_vertex_index),
			orig_pos.getY(marked_vertex_index), orig_pos.getZ(marked_vertex_index));

		updateModelGeometry(current_pos);
		reset_vertex_flag = false;
	} else if (reset_all_flag) {
		const current_pos = model.geometry.getAttribute('position');
		const orig_pos = model.geometry.getAttribute('original_position');
		for (let i = 0; i < current_pos.array.length; i++) {
			current_pos.setXYZ(i, orig_pos.getX(i), orig_pos.getY(i), orig_pos.getZ(i));
		}
		if (marked_vertex != undefined)
			removeMarkedVertex();

			updateModelGeometry(current_pos);
		reset_all_flag = false;
	}

	controls.update();
}

function updateModelGeometry(position) {
	position.needsUpdate = true;
	model.geometry.computeBoundingBox();
	model.geometry.computeBoundingSphere();
	model.geometry.computeVertexNormals();
}

function createPoint(position) {
	let point = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({color: 0xFF0000}));
	point.position.set(...position);
	point.original_position = new THREE.Vector3(...position);
	point.name = "marked vertex";
	point.marked_x = false;
	point.marked_y = false;
	point.marked_z = false;
	point.material.depthTest = false;
	
	const arrow_x = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1, 0xff0000, 0.5, 0.5);
	arrow_x.name = "x_axis";
	arrow_x.children.forEach(child => {
		child.name = "x_axis";
		child.material.transparent = true;
		child.material.opacity = 0.5;
		child.material.depthTest = false;
	});
	const arrow_y = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1, 0x00ff00, 0.5, 0.5);
	arrow_y.name = "y_axis";
	arrow_y.children.forEach(child => {
		child.name = "y_axis";
		child.material.transparent = true;
		child.material.opacity = 0.5;
		child.material.depthTest = false;
	});
	const arrow_z = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1, 0x0000ff, 0.5, 0.5);
	arrow_z.name = "z_axis";
	arrow_z.children.forEach(child => {
		child.name = "z_axis";
		child.material.transparent = true;
		child.material.opacity = 0.5;
		child.material.depthTest = false;
	});
	point.add(arrow_x);
	point.add(arrow_y);
	point.add(arrow_z);

	// arrowhelper should always render on top
	point.renderOrder = 999;
	
	scene.add(point);

	return point;
}

export function handleLandmarks() {
	if (marked_vertex == undefined) {
		messageToUser("mark a vertex to create a landmark for it");
		return;
	}
	let exisiting_landmark = model.userData.landmarks.find(landmark => landmark.position.equals(marked_vertex.position));
	if (exisiting_landmark != undefined) {
		scene.remove(exisiting_landmark);
		messageToUser("existing landmark removed");
	} else {
		createLandmark(marked_vertex.position);
		messageToUser("landmark created");
	}
}

function createLandmark(position) {
	let landmark = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshPhongMaterial({color: 0x00FF00}));
	landmark.position.set(...position);
	landmark.name = "landmark: " + position.toArray();

	scene.add(landmark);
	model.userData.landmarks.push(landmark);
	return landmark;
}

export function loadLandmarks() {
	// remove all existing landmarks
	model.userData.landmarks.forEach(landmark => scene.remove(landmark));

	// load the predefined landmarks
	let template_vertices = getVertices(scene.getObjectByName("template_model"));
	let model_vertices = getVertices(model);
	model.userData.predefined_landmarks.forEach(predefined_landmark => {
		// as the predefined landmarks have the template as positional reference
		// the corresponding indices have to be determined to get the actual models position
		for (let i = 0; i < template_vertices.length; i++) {
			if (template_vertices[i].equals(new THREE.Vector3(...predefined_landmark.coordinates))) {
				predefined_landmark.index = i;
			}
		}
		createLandmark(model_vertices[predefined_landmark.index]);
	});
}

function updateMarkedVertex(position) {
	if (marked_vertex == undefined)
		marked_vertex = createPoint(position);
	else {
		resetVertexGui();
		marked_vertex.position.set(...position);
		marked_vertex.original_position.set(...position);
	}
}

function getVertices(object) {
	let tmp = object.geometry.attributes.position.array;
	let vertices = new Array;
	for (let i = 0; i < tmp.length; i += 3) {
		vertices.push(new THREE.Vector3(tmp[i], tmp[i + 1], tmp[i + 2]));
	}
	return vertices;
}

function markNearestVertex(clicked_position) {
	let vertex_positions = getVertices(model);
	let nearestPoint = vertex_positions[0];
	marked_vertex_index = 0;
	for (let i = 0; i < vertex_positions.length; i++) {
		if (clicked_position.distanceTo(vertex_positions[i]) < clicked_position.distanceTo(nearestPoint)) {
			nearestPoint = vertex_positions[i];
			marked_vertex_index = i;
		}
	};
	console.log("position of marked vertex: ", nearestPoint);
	messageToUser("index of marked vertex: " + marked_vertex_index);
	updateMarkedVertex(nearestPoint);
}

function removeMarkedVertex() {
	scene.remove(scene.getObjectByName("marked vertex"));
	resetVertexGui();
	if (marked_vertex != undefined)
		messageToUser("vertex no longer marked");
	marked_vertex = undefined;
}

function drawVertices(mesh, name) {
	let vertices = mesh.geometry.getAttribute('position');
	let geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', vertices);
	geometry.setAttribute('color', new THREE.BufferAttribute(Float32Array.from({length: 3 * vertices.count}, (_, i) => i % 3 == 0 ? 1 : 0), 3));
	let material = new THREE.PointsMaterial({vertexColors: true});
	let points = new THREE.Points(geometry, material);
	points.name = name;
	if (model_vertices != undefined)
		points.visible = model_vertices.visible;
	model_vertices = points;
	scene.add(points);
}

function loadMesh(vertices, indices, name) {
	let geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
	geometry.setIndex(new THREE.BufferAttribute(indices, 1));
	let material = new THREE.MeshPhongMaterial({color: 0xf0f0f0, side: THREE.DoubleSide});  // side: THREE.DoubleSide to turn off backface culling
	let mesh = new THREE.Mesh(geometry, material);

	mesh.geometry.computeVertexNormals();
	
	// set the orbit controls target to the center of the mesh
	// src: https://stackoverflow.com/questions/38305408/threejs-get-center-of-object
	mesh.geometry.computeBoundingBox();
	let center = new THREE.Vector3();
	geometry.boundingBox.getCenter(center);
	mesh.localToWorld(center);
	controls.target.set(...center);

	const position = mesh.geometry.getAttribute('position');
	mesh.geometry.attributes.original_position = position.clone();
	mesh.name = name;
	mesh.userData.landmarks = new Array;
	model = mesh;
	scene.add(mesh);

	hideDownloadLink();
}

export function updateMesh(vertices) {
	removeMarkedVertex();

	let predefined_landmarks = model.userData.predefined_landmarks;
	let vertex_indices = model.userData.vertex_indices;
	let model_color = model.material.color;

	model.userData.landmarks.forEach(landmark => scene.remove(landmark));
	scene.remove(scene.getObjectByName("model"));
	scene.remove(scene.getObjectByName("points"));
	loadMesh(vertices, vertex_indices, "model");
	drawVertices(model, "points");

	model.userData.predefined_landmarks = predefined_landmarks;
	model.userData.vertex_indices = vertex_indices;
	model.material.color = model_color;
}

function centerMeshPosition(mesh_position) {
	console.log(mesh_position);
	let position_matrix = Math.reshape(mesh_position, [3, -1]);
	// subtract average position from every point to center mesh to origin of space
	let avg_position = position_matrix.map(dim => (dim.reduce((a, b) => a + b, 0) / dim.length));
	position_matrix = Math.transpose(position_matrix);
	position_matrix.forEach(elem => {
		for (let i = 0; i < elem.length; i++) {
			elem[i] -= avg_position[i];
		}
	});
	return new Float32Array(Math.flatten(position_matrix));
}

export function switchModels() {
	model.visible = false;
	model_vertices.visible = false;
	if (model.name == "template_model") {
		model = scene.getObjectByName("model");
		model_vertices = scene.getObjectByName("points");
		messageToUser("model");
	} else if (model.name == "model") {
		model = scene.getObjectByName("template_model");
		model_vertices = scene.getObjectByName("template_points");
		messageToUser("template model");
	}
	model.visible = true;
	model_vertices.visible = false;
}



function onMouseDown(event) {
	mouse_down = true;
	if (event.target != document.querySelector('#c')) return;
	let mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
	raycaster.setFromCamera(mouse, camera);

	if (window.event.ctrlKey) { // set marked vertex with crtl + click
		let intersects = raycaster.intersectObject(model);
		if (intersects.length == 0) {
			if (marked_vertex == undefined) 
				messageToUser("no intersection with the model found");
			else {
				removeMarkedVertex();
			}
			return;
		}
		console.log("intersection point: ", intersects[0].point);
		markNearestVertex(intersects[0].point);
		return;
	}
	
	if (marked_vertex == undefined) return;

	// vertices marked with landmarks should not be able to move
	for (let i = 0; i < model.userData.landmarks.length; i++) {
		if (model.userData.landmarks[i].position.equals(marked_vertex.position)) {
			messageToUser("Vertices marked with landmarks cannot move");
			return;
		}
	}
	// change marked vertex position
	let intersects = raycaster.intersectObject(marked_vertex);
	if (intersects.length == 0) {
		messageToUser("no intersection with the arrow axes found");
		return;
	}
	messageToUser(intersects[0].object.name + " selected");
	intersects[0].object.parent.children[0].material.opacity = 1;
	intersects[0].object.parent.children[1].material.opacity = 1;
	if (intersects[0].object.name == "x_axis") marked_vertex.marked_x = true;
	else if (intersects[0].object.name == "y_axis") marked_vertex.marked_y = true;
	else if (intersects[0].object.name == "z_axis") marked_vertex.marked_z = true;
}


function onMouseUp(event) {
	mouse_down = false;
	if (marked_vertex == undefined) return;
	marked_vertex.children.forEach(child => {
		child.children[0].material.opacity = 0.5;
		child.children[1].material.opacity = 0.5;
	});

	marked_vertex.marked_x = false;
	marked_vertex.marked_y = false;
	marked_vertex.marked_z = false;

	const current_pos = model.geometry.getAttribute('position');
	const orig_pos = model.geometry.getAttribute('original_position');
	updateVertexGui(new THREE.Vector3(
		current_pos.getX(marked_vertex_index) - orig_pos.getX(marked_vertex_index),
		current_pos.getY(marked_vertex_index) - orig_pos.getY(marked_vertex_index),
		current_pos.getZ(marked_vertex_index) - orig_pos.getZ(marked_vertex_index)));
}


function onMouseMove(event) {
	if (!mouse_down || marked_vertex == undefined ||
			!(marked_vertex.marked_x || marked_vertex.marked_y || marked_vertex.marked_z)) {
		controls.enableRotate = true;
		return;
	}
	controls.enableRotate = false;

	if (marked_vertex.marked_x) vertex_change.x = event.movementX / 4;
	if (marked_vertex.marked_y) vertex_change.y = -(event.movementY / 4);
	if (marked_vertex.marked_z) vertex_change.z = event.movementX / 4;
}


function loadInput(event) {
	// remove exisiting model
	removeMarkedVertex();
	scene.remove(scene.getObjectByName("template_model"));
	scene.remove(scene.getObjectByName("template_points"));
	scene.remove(scene.getObjectByName("model"));
	scene.remove(scene.getObjectByName("points"));

	let spinner = document.getElementById('spinner');
	spinner.style.display = "inline-block";

	let file = document.getElementById('input').files[0];
	
	// hdf5 loader  https://github.com/usnistgov/jsfive
	let reader = new FileReader();
	reader.onloadend = function(evt) { 
		let array_buffer = evt.target.result;
		let f = new hdf5.File(array_buffer, file.name);

		// determine the path of the .h5 file, morphable models have a seperate folder for the shape, statistical models don't
		let path = 'shape/';
		try {
			f.get('shape');
		} catch (error) {
			console.log(error + " -> model data in root folder");
			path = '';
		}

		// loading template model
		let template_points = f.get(path + 'representer/points');  // coordinates of template model points
		let template_cells = f.get(path + 'representer/cells');    // indices of template model for triangles

		// weird I would have to do this but input has flipped dimensions? -> probably row/column major differences
		let vertex_indices = new Uint16Array(Math.flatten(Math.transpose(Math.reshape(template_cells.value, template_cells.shape))));
		let template_vertices = Math.flatten(Math.transpose(Math.reshape(template_points.value, template_points.shape)))

		loadMesh(template_vertices, vertex_indices, "template_model");

		drawVertices(model, "template_points");

		model.visible = false;
		model_vertices.visible = false;

		// load prior values for posterior computation
		loadValues(f, path);

		loadMesh(f.get(path + 'model/mean').value, vertex_indices, "model");

		drawVertices(model, "points");

		try {
			model.userData.predefined_landmarks = JSON.parse(f.get('metadata/landmarks/json').value);
		} catch(error) {
			messageToUser(error + " -> no landmarks available");
		}
		
		model.userData.vertex_indices = vertex_indices;

		spinner.style.display = "none";
	}
	reader.readAsArrayBuffer(file);
}

export function resetVertex() {
	if (marked_vertex == undefined)
		messageToUser("You have to mark a vertex to reset its position");
	else {
        resetVertexGui();
		reset_vertex_flag = true;
	}
}

export function resetAllVertices() {
	reset_all_flag = true;
}
