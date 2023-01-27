import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils';
import { GUI } from 'dat.gui/build/dat.gui.module.js';
// import * as hdf5 from 'jsfive';
import h5wasm from 'h5wasm';
import { BoxGeometry, BufferGeometry } from 'three';
import { Vector3 } from 'babylonjs';

let canvas, renderer, camera, controls, scene, gui, raycaster;
let model;
let vertex_selected = false;
let marked_vertex;

// gui attributes
let point_scale = 1;
let vertex_change = new THREE.Vector3(0, 0, 0);

init();
render();

function init() {
  // init rendering
  canvas = document.querySelector('#c');
  renderer = new THREE.WebGLRenderer({canvas});

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.position.set(0, 10, 10);

  controls = new OrbitControls(camera, canvas);
  // controls.maxDistance = 1;
  // controls.minDistance = 0.1;
  controls.update();

  scene = new THREE.Scene();
  scene.background = new THREE.Color('black');

  raycaster = new THREE.Raycaster();

  // gui stuff
  {
    gui = new GUI();
    gui.addColor({color: '#000000'}, 'color')
      .name('background color')
      .onChange(function(e) {
        scene.background = new THREE.Color(e);
    });
    gui.add({point_scale}, "point_scale", 0.1, 2, 0.005).name("point scale").onChange(value => point_scale = value);
    let vertex_folder = gui.addFolder('change vertex position');
    vertex_folder.add(vertex_change, "x", -1, 1, 0.05).name("change vertex x")
      .onChange(value => {vertex_change.x = value; vertex_selected = true;});
    vertex_folder.add(vertex_change, "y", -1, 1, 0.05).name("change vertex y")
      .onChange(value => {vertex_change.y = value; vertex_selected = true;});
    vertex_folder.add(vertex_change, "z", -1, 1, 0.05).name("change vertex z")
      .onChange(value => {vertex_change.z = value; vertex_selected = true;});
    vertex_folder.add({reset: function() {
      vertex_change.set(0, 0, 0);
      vertex_folder.__controllers.forEach(controller => controller.setValue(controller.initialValue));
      vertex_selected = true;
      }}, "reset").name("reset position");
  }

  // plane for reference of space
  {
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
  }

  // testing cube
  const cube = new THREE.Mesh(new BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: 0x00ff00}));
  cube.geometry.deleteAttribute('uv');  // TODO: maybe save these attributes and reintegrate them after merging?
  cube.geometry.deleteAttribute('normal');
  cube.geometry = BufferGeometryUtils.mergeVertices(cube.geometry);
  
  const position = cube.geometry.getAttribute('position');
  cube.geometry.attributes.original_position = position.clone();
  model = cube;
  scene.add(cube);
  // drawVertices(cube);


  // hemisphere light
  {
    const skyColor = 0xB1E1FF;  // light blue
    const groundColor = 0xB97A20;  // brownish orange
    const intensity = 1;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(light);
  }  

  // directional light
  {
    const light = new THREE.DirectionalLight(0xFFFFFF, 1);
    light.position.set(0, 10, 0);
    light.target.position.set(-50, 0, 0);
    scene.add(light);
    scene.add(light.target);
  }

  // obj loader
  {
    const objLoader = new OBJLoader();
    objLoader.load('../models/HumanBaseMesh.obj',
    // called when resource is loaded
    function ( object ) {
      // model = object.children[0];
      // model.geometry = BufferGeometryUtils.mergeVertices(model.geometry);
      // console.log(model);
      // model.geometry.attributes.position.array[0] = 100;
      // model.geometry.attributes.position.array[1] = 100;
      // model.geometry.attributes.position.array[2] = 100;


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
  }

  document.addEventListener('mousedown', onMouseDown);
  document.getElementById("input").onchange = loadInput;
}

function onMouseDown(event) {
  let mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObject(model);
  if (intersects.length == 0) {
    console.log("no intersections found");
    return;
  }
  intersects[0].point.color = new THREE.Color(Math.random() * 0xffffff);
  console.log("intersection point: ", intersects[0].point);
  drawNearestVertex(intersects[0].point);
}

function loadInput(event) {
  console.log("here");
  let file = document.getElementById('input').files[0];
  // h5wasm loader https://github.com/usnistgov/h5wasm
  // let f = new h5wasm.File('../models/' + file.name, 'r');
  // console.log(f.keys());
  
  // hdf5 loader  https://github.com/usnistgov/jsfive
  // let reader = new FileReader();
  // reader.onloadend = function(evt) { 
  //   let array_buffer = evt.target.result;
  //   let f = new hdf5.File(array_buffer, file.name);
  //   let points = f.get('expression/representer/points');
  //   console.log(points);
  // }
  // reader.readAsArrayBuffer(file);
}

// rendering
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

function render() {
  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  scene.children.forEach(element => {
    if (element.name == "vertex") {
      element.scale.setScalar(point_scale);
    }
  });
  if (vertex_selected) {
    const model_position = model.geometry.getAttribute('position');
    const model_o_pos = model.geometry.getAttribute('original_position');
    model_position.setXYZ(0, model_o_pos.getX(0) + vertex_change.x, model_o_pos.getY(0) + vertex_change.y, model_o_pos.getZ(0) + vertex_change.z);
    model_position.needsUpdate = true;
    model.geometry.computeBoundingBox();
    model.geometry.computeBoundingSphere();

    const vertex_o_pos = marked_vertex.original_position;
    marked_vertex.position.set(vertex_o_pos.x + vertex_change.x, vertex_o_pos.y + vertex_change.y, vertex_o_pos.z + vertex_change.z);
    vertex_selected = false;
  }

  controls.update();
  renderer.render(scene, camera);

  requestAnimationFrame(render);
}

function createPoint(position) {
  let point = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({color: 0xFF5555}));
  point.position.set(...position);
  point.original_position = new THREE.Vector3(...position);
  point.name = "vertex";
  scene.add(point);
  return point;
}

function updateMarkedVertex(position) {
  if (marked_vertex == undefined)
    marked_vertex = createPoint(position);
  else
    marked_vertex.position.set(...position);
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
  const model_vertices = getVertices(model);
  let nearestPoint = model_vertices[0];
  model_vertices.forEach(element => {
    if (clicked_position.distanceTo(element) < clicked_position.distanceTo(nearestPoint))
      nearestPoint = element;
  });
  updateMarkedVertex(nearestPoint);
}

function drawVertices(object) {
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute( 'position', new THREE.BufferAttribute( object.geometry.attributes.position.array, 3 ) );
  let material = new THREE.PointsMaterial( {color: 0xff0000} );
  let points = new THREE.Points(geometry, material);
  scene.add(points);
}
