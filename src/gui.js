import {updateMesh, switchModels, scene, light, camera, controls, model, handleLandmarks, loadLandmarks, resetVertex, resetAllVertices} from './main.js';
import { alpha, generateAlpha, updateAlpha, alphaFromS, alphaFromObservations, computePosterior } from './computation.js';
import { GUI } from 'dat.gui/build/dat.gui.module.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import * as THREE from 'three';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

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
    gui = new GUI();
    
    gui.add({show_vertices: function() {
        let points = scene.getObjectByName("points");
        points.visible = !points.visible;
    }}, "show_vertices").name("show/hide vertices");

    gui.add({landmark: handleLandmarks}, "landmark").name("create/remove landmark");
    gui.add({load_landmarks: loadLandmarks}, "load_landmarks").name("load landmarks");

    gui.add({posterior: function() {
        updateMesh(computePosterior(model));
        updateAlphaScale();
    }}, "posterior").name("compute posterior");

    let alpha_folder = gui.addFolder("scale principal components");
    for (let i = 0; i < alpha_scale.length; i++) {
        alpha_controllers.push(alpha_folder.add({alpha_scale: alpha_scale[i]}, "alpha_scale", -3, 3, 0.001).name("index " + i)
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
    let controller_pca_index = alpha_indexed_folder.add({pca_index}, "pca_index", 0, 10, 1).name("pca index")
        .onChange(value => {
            pca_index = value;
            controller_alpha_scale.setValue(alpha.arraySync()[pca_index]);
    });

    // sets all alpha values to 0
    gui.add({set_alpha_zero: function() {
        generateAlpha("zero");
        updateMesh(updateAlpha(alpha.arraySync()[0], 0));
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
    light_folder.add(light.position, "x", -50, 50, 0.5).name("directional light x")
        .onChange(value => light.position.x = value);
    light_folder.add(light.position, "y", -50, 50, 0.5).name("directional light y")
        .onChange(value => light.position.y = value);
    light_folder.add(light.position, "z", -50, 50, 0.5).name("directional light z")
        .onChange(value => light.position.z = value);
    light_folder.add(light, "intensity", 0, 1, 0.05).name("directional light intensity")
        .onChange(value => light.intensity = value);

    let camera_folder = settings.addFolder("camera settings");
    camera_folder.add({y_axis: function() {
        if (camera.up.y == 1) camera.up.set(0, -1, 0);
        else  camera.up.set(0, 1, 0);
        controls.rotateSpeed *= -1;
    }}, "y_axis").name("flip y axis");

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
    }}, "export_as_ply").name("export model as .ply file");

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

function updateAlphaScale() {
    do_update_mesh = false;
    for (let i = 0; i < alpha_controllers.length; i++) {
        alpha_controllers[i].setValue(alpha.arraySync()[i]);
    }
    do_update_mesh = true;
}

export function messageToUser(message) {
    Toastify({
        text: message,
        duration: 5000,
        gravity: "bottom",
        position: "center"
    }).showToast();

    console.log(message);
}

export function hideDownloadLink() {
    let link = document.getElementById("downloadlink");
	link.href = undefined;
	link.style.display = 'none';
}