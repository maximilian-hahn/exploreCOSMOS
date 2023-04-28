import {computeAndShowPosterior, switchModels, scene} from './script.js';
import { GUI } from 'dat.gui/build/dat.gui.module.js';
import * as THREE from 'three';

export let point_scale = 10;
export let variance_scale = 0;
export let variance_changed = false;
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
        computeAndShowPosterior();
    }}, "posterior").name("compute posterior");

    gui.add({landmark: function() {
        if (marked_vertex == undefined) {
            console.log("mark a vertex to create a landmark for it");
            return;
        }
        landmarks.forEach(landmark => {
        if (landmark.position == position)
            scene.remove(landmark);
            return;
        });
        // TODO: test; does the above return work in preventing next line?
        createLandmark(marked_vertex.position);
    }}, "landmark").name("create/delete landmark");

    let variance_folder = gui.addFolder("pca variance");
    let controller_variance_scale = variance_folder.add({variance_scale}, "variance_scale", -0.1, 0.1, 0.001).name("variance scale")
        .onChange(value => {
        variance_scale = value;
        variance_changed = true;
        });
    variance_folder.add({pca_index}, "pca_index", 0, 20, 1).name("pca index")
        .onChange(value => {
        pca_index = value;
        controller_variance_scale.setValue(z.arraySync()[pca_index]);
        });
    variance_folder.add({reset_variance_scale: function() {
        model.userData.z = tf.zeros(model.userData.z.shape);
        variance_scale = 0;
        pca_index = 0;
        variance_folder.__controllers.forEach(controller => controller.setValue(controller.initialValue));
        variance_changed = true;
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
}

export function reset_vertex_gui() {
    vertex_change.set(0, 0, 0);
    vertex_folder.__controllers.forEach(controller => controller.setValue(controller.initialValue));
  }