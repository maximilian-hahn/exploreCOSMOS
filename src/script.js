import './style.css';
import {initGui, point_scale, vertex_change, resetVertexGui} from './gui.js';
import {loadValues} from './computation.js';
import * as THREE from 'three';
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
let reset_orig_flag = false;
let mouse_down = false;

init();
animate();

function init() {
  // init rendering
  canvas = document.querySelector('#c');
  renderer = new THREE.WebGLRenderer({canvas});
  renderer.autoClear = false;

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100000);
  camera.position.set(0, 0, 150);
  console.log(camera);

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
  scene.children.forEach(element => {
    if (element.name == "marked vertex" || element.name.startsWith("landmark")) element.scale.setScalar(point_scale);
  });

  if (vertex_change.length() > 0) {
    const model_position = model.geometry.getAttribute('position');
    let model_old_pos = model_position;
    let marked_vertex_old_pos = marked_vertex.position;
    if (reset_orig_flag) {
      model_old_pos = model.geometry.getAttribute('original_position');
      marked_vertex_old_pos = marked_vertex.original_position;
      reset_orig_flag = false;
    }

    model_position.setXYZ(marked_vertex_index, 
      model_old_pos.getX(marked_vertex_index) + vertex_change.x, 
      model_old_pos.getY(marked_vertex_index) + vertex_change.y, 
      model_old_pos.getZ(marked_vertex_index) + vertex_change.z);
    
    model_position.needsUpdate = true;
    model.geometry.computeBoundingSphere();
    model.geometry.computeVertexNormals();

    marked_vertex.position.set(marked_vertex_old_pos.x + vertex_change.x, marked_vertex_old_pos.y + vertex_change.y, marked_vertex_old_pos.z + vertex_change.z);

    vertex_change.set(0, 0, 0);
  }

  controls.update();
}


function createPoint(position) {
  let point = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({color: 0xFF0000}));
  point.position.set(...position);
  point.original_position = new THREE.Vector3(...position);
  point.name = "marked vertex";
  point.marked_x = false;
  point.marked_y = false;
  point.marked_z = false;
  
  const arrow_x = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 1, 0xff0000, 0.5, 0.5);
  arrow_x.name = "x_axis";
  arrow_x.children[0].name = "x_axis";
  arrow_x.children[1].name = "x_axis";
  arrow_x.children[0].material.transparent = true;
  arrow_x.children[0].material.opacity = 0.5;
  arrow_x.children[1].material.transparent = true;
  arrow_x.children[1].material.opacity = 0.5;
  const arrow_y = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1, 0x00ff00, 0.5, 0.5);
  arrow_y.name = "y_axis";
  arrow_y.children[0].name = "y_axis";
  arrow_y.children[1].name = "y_axis";
  arrow_y.children[0].material.transparent = true;
  arrow_y.children[0].material.opacity = 0.5;
  arrow_y.children[1].material.transparent = true;
  arrow_y.children[1].material.opacity = 0.5;
  const arrow_z = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 1, 0x0000ff, 0.5, 0.5);
  arrow_z.name = "z_axis";
  arrow_z.children[0].name = "z_axis";
  arrow_z.children[1].name = "z_axis";
  arrow_z.children[0].material.transparent = true;
  arrow_z.children[0].material.opacity = 0.5;
  arrow_z.children[1].material.transparent = true;
  arrow_z.children[1].material.opacity = 0.5;
  point.add(arrow_x);
  point.add(arrow_y);
  point.add(arrow_z);
  
  scene.add(point);

  return point;
}

export function handleLandmarks() {
  if (marked_vertex == undefined) {
    console.log("mark a vertex to create a landmark for it");
    return;
  }
  let exisiting_landmark = model.userData.landmarks.find(landmark => landmark.position.equals(marked_vertex.position));
  if (exisiting_landmark != undefined) {
    scene.remove(exisiting_landmark);
    console.log("landmark removed");
  } else {
    createLandmark(marked_vertex.position);
    console.log("landmark created");
  }
}

function createLandmark(position) {
  let landmark = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({color: 0x00FF00}));
  landmark.position.set(...position);
  landmark.name = "landmark: " + position.toArray();
  console.log(landmark.name); // TODO

  scene.add(landmark);
  model.userData.landmarks.push(landmark);
  return landmark;
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

function drawNearestVertex(clicked_position) {
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
  console.log("Index of vertex: ", marked_vertex_index);
  updateMarkedVertex(nearestPoint);
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
  // console.log(points);
  model_vertices = points;
  scene.add(points);
}

function loadMesh(vertices, indices, name) {
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  let material = new THREE.MeshPhongMaterial({color: 0xf0f0f0, side: THREE.DoubleSide});  // side: THREE.DoubleSide to turn off backface culling
  let mesh = new THREE.Mesh(geometry, material);

  // mesh.geometry = BufferGeometryUtils.mergeVertices(mesh.geometry);
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
  console.log(name + ": ");
  console.log(mesh);
  model = mesh;
  scene.add(mesh);

  
}

export function updateMesh(vertices) {
  let point_indices = model.userData.point_indices;

  scene.remove(scene.getObjectByName("model"));
  scene.remove(scene.getObjectByName("points"));
  loadMesh(vertices, point_indices, "model");
  drawVertices(model, "points");

  model.userData.point_indices = point_indices;
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
  } else if (model.name == "model") {
      model = scene.getObjectByName("template_model");
      model_vertices = scene.getObjectByName("template_points");
  }
  model.visible = true;
  model_vertices.visible = true;
}



function onMouseDown(event) {
  mouse_down = true;
  if (event.target != document.querySelector('#c')) return;
  let mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);

  if (window.event.ctrlKey) { // set marked vertex with crtl + click
    let intersects = raycaster.intersectObject(model);
    if (intersects.length == 0) {
      console.log("no intersection with the model found");
      scene.remove(scene.getObjectByName("marked vertex"));
      marked_vertex = undefined;
      return;
    }
    console.log("intersection point: ", intersects[0].point);
    drawNearestVertex(intersects[0].point);
    return;
  }
  
  // change marked vertex position
  if (marked_vertex == undefined) return;
  let intersects = raycaster.intersectObject(marked_vertex);
  if (intersects.length == 0) {
    console.log("no intersection with the arrow axes found");
    return;
  }
  console.log(intersects[0].object.name);
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

    // weird I would have to do this but input has flipped dimensions?
    let point_indices = new Uint16Array(Math.flatten(Math.transpose(Math.reshape(template_cells.value, template_cells.shape))));
    
    scene.remove(scene.getObjectByName("template_model"));
    loadMesh((template_points.value), point_indices, "template_model");

    scene.remove(scene.getObjectByName("template_points"));
    drawVertices(model, "template_points");

    model.visible = false;
    model_vertices.visible = false;

    // load prior values for posterior computation
    loadValues(f, path);

    scene.remove(scene.getObjectByName("model"));
    loadMesh(f.get(path + 'model/mean').value, point_indices, "model");

    scene.remove(scene.getObjectByName("points"));
    drawVertices(model, "points");

    model.userData.point_indices = point_indices;
  }
  reader.readAsArrayBuffer(file);
}

