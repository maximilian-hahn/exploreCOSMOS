import {updateMesh, switchModels, scene, light, camera, controls, model, handleLandmarks, loadLandmarks, resetVertex, resetAllVertices, recenterCamera, removeAllLandmarks} from './main.js';
import { alpha, generateAlpha, updateAlpha, alphaFromS, alphaFromObservations, computePosterior } from './computation.js';
import { GUI } from 'dat.gui/build/dat.gui.module.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import * as THREE from 'three';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import Shepherd from 'shepherd.js';
import "shepherd.js/dist/css/shepherd.css";
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export let point_scale = 10;
export let pca_index = 0;
export let vertex_change = new THREE.Vector3(0, 0, 0);
export let internal_vertex_change = new THREE.Vector3(0, 0, 0);
internal_vertex_change.update = false;

let gui, vertex_folder;
let vertex_controllers = new Array();
let alpha_scale = new Array(10).fill(0);
let alpha_controllers = new Array();
let do_update_mesh = true;
let exported_file = null;

export function initGui() {
    gui = new GUI({name: "control panel"});
    gui.__closeButton.innerText = "close controls";
    
    gui.add({show_vertices: function() {
        let points = scene.getObjectByName("points");
        points.visible = !points.visible;
    }}, "show_vertices").name("show/hide vertices");

    gui.add({posterior: function() {
        updateMesh(computePosterior(model), true);
        updateAlphaScale();
    }}, "posterior").name("compute posterior");

    let alpha_folder = gui.addFolder("scale principal components");
    for (let i = 0; i < alpha_scale.length; i++) {
        alpha_controllers.push(alpha_folder.add({alpha_scale: alpha_scale[i]}, "alpha_scale", -3, 3, 0.001).name("pc " + i)
            .onChange(value => {
                if (do_update_mesh) updateMesh(updateAlpha(value, i));
                // controller_alpha_scale.setValue(alpha.arraySync()[pca_index]);
            }));
    }
    let alpha_indexed_folder = alpha_folder.addFolder("manually define index");
    let controller_alpha_scale = alpha_indexed_folder.add({alpha_scale: alpha_scale[pca_index]}, "alpha_scale", -3, 3, 0.001).name("alpha scale")
        .onChange(value => {
            if (do_update_mesh) updateMesh(updateAlpha(value, pca_index));
            alpha_controllers[pca_index].setValue(value);
        });
    let controller_pca_index = alpha_indexed_folder.add({pca_index}, "pca_index", 0, 10, 1).name("pc index")
        .onChange(value => {
            pca_index = value;
            controller_alpha_scale.setValue(alpha.arraySync()[pca_index]);
    });

    // sets all alpha values to 0
    gui.add({set_alpha_zero: function() {
        generateAlpha("zero");
        updateMesh(updateAlpha(0, 0));
        updateAlphaScale();
    }}, "set_alpha_zero").name("reset to mean shape");

    // generates random normally distributed alpha values
    gui.add({reset_alpha_scale: function() {
        do_update_mesh = false;
        generateAlpha("random");
        controller_pca_index.setValue(0);
        updateMesh(updateAlpha(alpha.arraySync()[0], 0));
        do_update_mesh = true;
        updateAlphaScale();
    }}, "reset_alpha_scale").name("generate random shape");

    let landmark_folder = gui.addFolder("landmarks");
    landmark_folder.add({landmark: handleLandmarks}, "landmark").name("create/remove landmark");
    landmark_folder.add({load_landmarks: loadLandmarks}, "load_landmarks").name("load landmarks");
    landmark_folder.add({remove_all: removeAllLandmarks}, "remove_all").name("remove all landmarks");


    let settings = gui.addFolder("settings");

    vertex_folder = settings.addFolder("vertex settings");
    vertex_controllers.push(vertex_folder.add(internal_vertex_change, "x", -256, 256, 0.01).name("change marked x")
        .onChange(() => internal_vertex_change.update = true));
    vertex_controllers.push(vertex_folder.add(internal_vertex_change, "y", -256, 256, 0.01).name("change marked y")
        .onChange(() => internal_vertex_change.update = true));
    vertex_controllers.push(vertex_folder.add(internal_vertex_change, "z", -256, 256, 0.01).name("change marked z")
        .onChange(() => internal_vertex_change.update = true));
    vertex_folder.add({reset_orig: resetVertex}, "reset_orig").name("reset marked vertex to original position");
    vertex_folder.add({reset_all: resetAllVertices}, "reset_all").name("reset all vertices to their original position");

    let light_folder = settings.addFolder("light settings");
    light_folder.add(light.position, "x", -10, 10, 0.1).name("x position")
        .onChange(value => light.position.x = value);
    light_folder.add(light.position, "y", -10, 10, 0.1).name("y postition")
        .onChange(value => light.position.y = value);
    light_folder.add(light.position, "z", -10, 10, 0.1).name("z position")
        .onChange(value => light.position.z = value);
    light_folder.add(light, "intensity", 0, 1, 0.05).name("light intensity")
        .onChange(value => light.intensity = value);

    let camera_folder = settings.addFolder("camera settings");
    camera_folder.add({y_axis: function() {
        if (camera.up.y == 1) camera.up.set(0, -1, 0);
        else  camera.up.set(0, 1, 0);
        controls.rotateSpeed *= -1;
    }}, "y_axis").name("flip y axis");
    camera_folder.add({recenter: recenterCamera}, "recenter").name("target camera to center of mesh");

    settings.addColor({color: '#ffffff'}, 'color').name('model color')
        .onChange(function(e) {
            model.material.color = new THREE.Color(e);
    });

    settings.add({point_scale}, "point_scale", 0.1, 100, 0.05).name("scale objects").onChange(value => point_scale = value);

    let debugging = settings.addFolder("debugging");
    debugging.add({show_template: switchModels}, "show_template").name("switch between template and model");
    debugging.add({alpha_from_s: function() {
        updateMesh(alphaFromS());
        updateAlphaScale();
    }}, "alpha_from_s").name("calculate alpha from s");
    debugging.add({alpha_from_observations: function() {
        updateMesh(alphaFromObservations());
        updateAlphaScale();
    }}, "alpha_from_observations").name("calculate alpha from observations");

    gui.add({export_as_ply: function() {
        const exporter = new PLYExporter();
        const data = new Blob([exporter.parse(model)], {type: 'text/plain'});

        // src: http://jsfiddle.net/UselessCode/qm5AG/
        // If we are replacing a previously generated file we need to
        // manually revoke the object URL to avoid memory leaks.
        if (exported_file !== null) window.URL.revokeObjectURL(exported_file);
        exported_file = window.URL.createObjectURL(data);

        let link = document.getElementById("downloadlink");
        link.href = exported_file;
        link.style.display = 'block';

        messageToUser("Download the .ply file in the bottom left")
    }}, "export_as_ply").name("export current shape as .ply file");


    // show controls at startup
    let controls_modal = document.getElementById("controls_modal");
    document.getElementById("close_controls").onclick = function() {
        controls_modal.style.display = "none";
        // startTutorial(); // TODO
    };

    gui.add({controls_info: function() {
        if (controls_modal.style.display == "none")
            controls_modal.style.display = "block";
        else
            controls_modal.style.display = "none";
    }}, "controls_info").name("controls overview");

    gui.add({more_info: function() {
        window.open("https://github.com/maximilian-hahn/BA", "_blank").focus();
    }}, "more_info").name("for more information click here");
}


function startTutorial() {
    const tour = new Shepherd.Tour({
        defaultStepOptions: {
            cancelIcon: {
                enabled: true
            },
            classes: 'class-1 class-2',
            scrollTo: { behavior: 'smooth', block: 'center' }
        }
    });

    const button_array = [
        {
            action() {
                return this.back();
            },
            classes: 'shepherd-button-secondary',
            text: 'Back'
        },
        {
            action() {
                return this.next();
            },
            text: 'Next'
        }
    ];

    tour.addStep({
        title: 'Welcome to the Tutorial',
        text: "If you use this application for the first time you can follow this tutorial to get a guided first look!",
        buttons: button_array,
        id: 'welcome'
    });


    // create div at projected 3D position for the tour to attach to
    const shape_div = document.createElement('div');
    shape_div.className = 'label';
    shape_div.id = 'shape_div';

    let shape_pos = new THREE.Vector3(0, 0, 0);
    shape_pos.project(camera);
    shape_pos.x = (shape_pos.x + 1) * window.innerWidth / 2;
    shape_pos.y = -(shape_pos.y - 1) * window.innerHeight / 2;
    shape_pos.z = 0;
    console.log(shape_pos);

    shape_div.style.position = "absolute";
    shape_div.style.left = shape_pos.x + 'px';
    shape_div.style.top = shape_pos.y + 'px';

    document.body.appendChild(shape_div);

    // TODO has to be updated every frame, arrow doesn't follow. maybe css2dobject?


    tour.addStep({
        title: 'The 3D Environment',
        text: "TODO",
        attachTo: {
            element: '#shape_div',
            on: 'right'
        },
        buttons: button_array,
        id: '3D shape'
    });
      
    tour.start();
}

export function resetVertexGui() {
    vertex_controllers.forEach(controller => controller.setValue(controller.initialValue));
    internal_vertex_change.update = false;
}

export function updateVertexGui(value) {
    vertex_folder.__controllers[0].setValue(value.x);
    vertex_folder.__controllers[1].setValue(value.y);
    vertex_folder.__controllers[2].setValue(value.z);
    internal_vertex_change.update = false;
}

export function updateAlphaScale() {
    do_update_mesh = false;
    for (let i = 0; i < alpha_controllers.length; i++) {
        alpha_controllers[i].setValue(alpha.arraySync()[i]);
    }
    do_update_mesh = true;
}

export function messageToUser(message, duration = 5, url = "") {
    Toastify({
        text: message,
        duration: duration * 1000,
        destination: url,
        newWindow: true,
        close: true,
        gravity: "bottom",
        position: "center"
    }).showToast();

    console.log(message);
}

function generateTextbox(message, url = "") {
    Toastify({
        text: message,
        duration: -1,
        close: true,
        destination: url,
        newWindow: true,
        position: "center"
    }).showToast();

    console.log(message);
}

export function hideDownloadLink() {
    let link = document.getElementById("downloadlink");
	link.href = undefined;
	link.style.display = 'none';
}