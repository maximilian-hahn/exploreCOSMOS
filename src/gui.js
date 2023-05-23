import {updateMesh, switchModels, scene, light, camera, controls, model, handleLandmarks} from './script.js';
import { alpha, generateAlpha, updateAlpha, alphaFromS, alphaFromObservations, computePosterior } from './computation.js';
import { GUI } from 'dat.gui/build/dat.gui.module.js';
import { PLYExporter } from 'three/addons/exporters/PLYExporter.js';
import * as THREE from 'three';

export let point_scale = 10;
export let vertex_change = new THREE.Vector3(0, 0, 0);
export let pca_index = 0;

let gui, vertex_folder;
let alpha_scale = new Array(10).fill(0);
let alpha_controllers = new Array();
let do_update_mesh = true;
let exported_file = null;

export function initGui() {
    gui = new GUI();
    gui.addColor({color: '#000000'}, 'color')
        .name('model color')
        .onChange(function(e) {
        model.material.color = new THREE.Color(e);
    });
    gui.add({show_vertices: function() {
        let points = scene.getObjectByName("points");
        points.visible = !points.visible;
    }}, "show_vertices").name("show/hide vertices");

    gui.add({show_template: switchModels}, "show_template").name("switch between template and model");
    gui.add({point_scale}, "point_scale", 0.1, 100, 0.05).name("point scale").onChange(value => point_scale = value);
    
    gui.add({posterior: function() {
        updateMesh(computePosterior(model));
    }}, "posterior").name("compute posterior");

    gui.add({landmark: handleLandmarks}, "landmark").name("create/remove landmark");

    {
        let alpha_folder = gui.addFolder("pca alpha");
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
        alpha_folder.add({reset_alpha_scale: function() {
            generateAlpha();
            controller_alpha_scale.setValue(alpha.arraySync()[0]);
            controller_pca_index.setValue(0);
            updateMesh(updateAlpha(alpha.arraySync()[0], 0));
            updateAlphaScale();
        }}, "reset_alpha_scale").name("generate random normally distributed values");
        alpha_folder.add({alpha_from_s: function() {
            updateMesh(alphaFromS());
            updateAlphaScale();
        }}, "alpha_from_s").name("calculate alpha from s");
        alpha_folder.add({alpha_from_observations: function() {
            updateMesh(alphaFromObservations());
            updateAlphaScale();
        }}, "alpha_from_observations").name("calculate alpha from observations");
    }

    vertex_folder = gui.addFolder("change vertex position");
    vertex_folder.add(vertex_change, "x", -50, 50, 0.5).name("change vertex x")
        .onChange(value => vertex_change.x = value);
    vertex_folder.add(vertex_change, "y", -50, 50, 0.5).name("change vertex y")
        .onChange(value => vertex_change.y = value);
    vertex_folder.add(vertex_change, "z", -50, 50, 0.5).name("change vertex z")
        .onChange(value => vertex_change.z = value);
    vertex_folder.add({reset_orig: function() {
        resetVertexGui();
        reset_orig_flag = true;
    }}, "reset_orig").name("reset to original position");
    vertex_folder.add({reset_all: function() {
        const current_pos = model.geometry.getAttribute('position');
        const orig_pos = model.geometry.getAttribute('original_position');
        for (let i = 0; i < current_pos.array.length; i++) {
        current_pos.setXYZ(i, orig_pos.getX(i), orig_pos.getY(i), orig_pos.getZ(i));
        }
        current_pos.needsUpdate = true;
        model.geometry.computeBoundingSphere();
    }}, "reset_all").name("reset all vertices");

    let light_folder = gui.addFolder("change directional light");
    light_folder.add(light.position, "x", -50, 50, 0.5).name("light x")
        .onChange(value => light.position.x = value);
    light_folder.add(light.position, "y", -50, 50, 0.5).name("light y")
        .onChange(value => light.position.y = value);
    light_folder.add(light.position, "z", -50, 50, 0.5).name("light z")
        .onChange(value => light.position.z = value);
    light_folder.add(light, "intensity", 0, 1, 0.05).name("light intensity")
        .onChange(value => light.intensity = value);

    let camera_folder = gui.addFolder("change camera settings");
    camera_folder.add({y_axis: function() {
        if (camera.up.y == 1) camera.up.set(0, -1, 0);
        else  camera.up.set(0, 1, 0);
        controls.rotateSpeed *= -1;
    }}, "y_axis").name("flip y axis");

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
    }}, "export_as_ply").name("export model as .ply file (download bottom left)");

}

export function resetVertexGui() {
    vertex_change.set(0, 0, 0);
    vertex_folder.__controllers.forEach(controller => controller.setValue(controller.initialValue));
}

function updateAlphaScale() {
    do_update_mesh = false;
    for (let i = 0; i < alpha_controllers.length; i++) {
        alpha_controllers[i].setValue(alpha.arraySync()[i]);
    }
    do_update_mesh = true;
}