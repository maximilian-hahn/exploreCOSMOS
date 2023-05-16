import {updateMesh, switchModels, scene, light, camera, controls, model, handleLandmarks} from './script.js';
import { alpha, generateAlpha, updateAlpha, computePosterior } from './computation.js';
import { GUI } from 'dat.gui/build/dat.gui.module.js';
import * as THREE from 'three';

export let point_scale = 10;
export let variance_scale = 0;
export let vertex_change = new THREE.Vector3(0, 0, 0);
export let pca_index = 0;

let gui, vertex_folder;

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

    let variance_folder = gui.addFolder("pca variance");
    let controller_variance_scale = variance_folder.add({variance_scale}, "variance_scale", -3, 3, 0.001).name("variance scale")
        .onChange(value => {
            variance_scale = value;
            updateMesh(updateAlpha());
        });
    let controller_pca_index = variance_folder.add({pca_index}, "pca_index", 0, 20, 1).name("pca index")
        .onChange(value => {
            pca_index = value;
            controller_variance_scale.setValue(alpha.arraySync()[pca_index]);
        });
    variance_folder.add({reset_variance_scale: function() {
        generateAlpha();
        controller_variance_scale.setValue(alpha.arraySync()[0]);
        controller_pca_index.setValue(0);
        updateMesh(updateAlpha());
    }}, "reset_variance_scale").name("reset variance scale");

    vertex_folder = gui.addFolder("change vertex position");
    vertex_folder.add(vertex_change, "x", -50, 50, 0.5).name("change vertex x")
        .onChange(value => vertex_change.x = value);
    vertex_folder.add(vertex_change, "y", -50, 50, 0.5).name("change vertex y")
        .onChange(value => vertex_change.y = value);
    vertex_folder.add(vertex_change, "z", -50, 50, 0.5).name("change vertex z")
        .onChange(value => vertex_change.z = value);
    vertex_folder.add({reset_orig: function() {
        reset_vertex_gui();
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

    let light_folder = gui.addFolder("change directional light position");
    light_folder.add(light.position, "x", -50, 50, 0.5).name("change light x")
        .onChange(value => light.position.x = value);
    light_folder.add(light.position, "y", -50, 50, 0.5).name("change light y")
        .onChange(value => light.position.y = value);
    light_folder.add(light.position, "z", -50, 50, 0.5).name("change light z")
        .onChange(value => light.position.z = value);
    light_folder.add(light, "intensity", 0, 1, 0.05).name("change light intensity")
        .onChange(value => light.intensity = value);

    let camera_folder = gui.addFolder("change camera settings");
    camera_folder.add({y_axis: function() {
        if (camera.up.y == 1) camera.up.set(0, -1, 0);
        else  camera.up.set(0, 1, 0);
        controls.rotateSpeed *= -1;
    }}, "y_axis").name("flip y axis");
}

export function reset_vertex_gui() {
    vertex_change.set(0, 0, 0);
    vertex_folder.__controllers.forEach(controller => controller.setValue(controller.initialValue));
  }