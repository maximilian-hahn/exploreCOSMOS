import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GUI } from 'dat.gui/build/dat.gui.module.js';

let canvas, renderer, camera, controls, scene, gui;
let model, model_vertices;
let point_scale = 1;

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

  gui = new GUI();
  gui.addColor({color: '#000000'}, 'color')
    .name('background color')
    .onChange(function(e) {
      scene.background = new THREE.Color(e);
  });
  gui.add({point_scale}, "point_scale", 0.1, 2, 0.005).name("point scale").onChange(value => point_scale = value);

  // plane for reference of space
  {
    const planeSize = 40;

    const loader = new THREE.TextureLoader();
    const texture = loader.load('https://r105.threejsfundamentals.org/threejs/resources/images/checker.png');
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

  // hemisphere light
  {
    const skyColor = 0xB1E1FF;  // light blue
    const groundColor = 0xB97A20;  // brownish orange
    const intensity = 1;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(light);
  }

  // testing cube
  // const geometry = new THREE.BoxGeometry(1, 1, 1);
  // const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
  // const cube = new THREE.Mesh(geometry, material);
  // model = cube;
  // model_vertices = getVertices(cube);
  // scene.add(cube);
  // drawVertices(cube);


  // directional light
  {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
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
      model = object.children[0];
      model_vertices = getVertices(model);

      controls.target.x = model.position.x;
      controls.target.y = model.position.y + 10;
      controls.target.z = model.position.z;
      controls.update();
      scene.add(model);
    },
    // called when loading is in progresses
    function ( xhr ) {
      console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
    },
    // called when loading has errors
    function ( error ) {
      console.log( 'An error happened' );
    });
  }

  document.addEventListener('mousedown', onMouseDown);
}

function onMouseDown(event) {
  let mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  let raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  let intersects = raycaster.intersectObject(model);
  intersects[0].point.color = new THREE.Color(Math.random() * 0xffffff);

  drawNearestVertex(intersects[0].point);
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

  controls.update();
  renderer.render(scene, camera);

  requestAnimationFrame(render);
}


function drawPoint(position) {
  let point = new THREE.Mesh( new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({color: 0xFF5555}));
  point.position.set(...position);
  point.name = "vertex";
  scene.add(point);
}

function getVertices(object) {
  let tmp = object.geometry.attributes.position.array;
  let vertices = new Array;
  for (let i = 0; i < tmp.length; i += 3) {
    vertices.push(new THREE.Vector3(tmp[i], tmp[i + 1], tmp[i + 2]));
  }
  return vertices;
}

function drawNearestVertex(position) {
  let nearestPoint = model_vertices[0];
  model_vertices.forEach(element => {
    if (position.distanceTo(element) < position.distanceTo(nearestPoint))
      nearestPoint = element;
  });
  drawPoint(nearestPoint);
}

function drawVertices(object) {
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute( 'position', new THREE.BufferAttribute( object.geometry.attributes.position.array, 3 ) );
  let material = new THREE.PointsMaterial( {color: 0xff0000} );
  let points = new THREE.Points(geometry, material);
  scene.add(points);
}