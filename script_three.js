import * as THREE from 'three';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from '/node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { GUI } from '/node_modules/dat.gui/build/dat.gui.module.js';

function main() {
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({canvas});
    
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 10, 10);
  
    const controls = new OrbitControls(camera, canvas);
    // controls.maxDistance = 1;
    // controls.minDistance = 0.1;
    controls.update();
  
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('black');
  
    const gui = new GUI();
    gui.addColor({color: '#000000'}, 'color')
      .name('background color')
      .onChange(function(e) {
        scene.background = new THREE.Color(e);
      });

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
  
    {
      const skyColor = 0xB1E1FF;  // light blue
      const groundColor = 0xB97A20;  // brownish orange
      const intensity = 1;
      const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
      scene.add(light);
    }
  
    {
      const color = 0xFFFFFF;
      const intensity = 1;
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(0, 10, 0);
      light.target.position.set(-50, 0, 0);
      scene.add(light);
      scene.add(light.target);
    }
  
    {
      const objLoader = new OBJLoader();
      objLoader.load('models/HumanBaseMesh.obj',
      // called when resource is loaded
      function ( object ) {
        object.scale.set(0.2, 0.2, 0.2);
        // object.position.set(0, 10, 0);
        // camera.lookAt(object.position);
        // controls.target = object.position;
        controls.target.x = object.position.x;
        controls.target.y = object.position.y + 2;
        controls.target.z = object.position.z;

        controls.update();
        scene.add( object );
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
  
      controls.update();
      renderer.render(scene, camera);
  
      requestAnimationFrame(render);
    }
  
    requestAnimationFrame(render);
  }
  
  main();