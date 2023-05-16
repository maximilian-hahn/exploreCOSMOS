import {variance_scale, pca_index} from './gui.js';
import * as tf from '@tensorflow/tfjs';
import * as Math from 'mathjs';

/**
 *  the math for posterior shape models is based on the paper: Medical Image Analysis 17 (2013) 959–973
 */

let mean;               // mean of current model
let Q;                  // matrix containing principal components in each column * standard deviation
let variance;           // variance or sigma^2 of above matrix; earlier components have a higher variance
let stddev;             // sigma or sqrt(variance)
export let alpha;       // coefficients for principal component matrix Q that follow a standard normal distribution
let s;                  // shape vector calculated using the formula s = mean + Q*alpha
let reference_position; // vector of the reference shape


// loads the necessary values for the posterior computation from the given .h5 file
export function loadValues(file, path) {
    mean = tf.tensor(file.get(path + 'model/mean').value);
    let pca_basis = file.get(path + 'model/pcaBasis');
    Q = tf.tensor(Math.reshape(pca_basis.value, pca_basis.shape));
    variance = tf.tensor(file.get(path + 'model/pcaVariance').value);
    stddev = variance.sqrt();
    Q = Q.mul(stddev);

    alpha = tf.zeros(variance.shape);   // generateAlpha();

    s = mean.clone();   // as alpha is initialized with zeros, s equals to mean

    reference_position = tf.tensor(file.get(path + 'representer/points').value);

    console.log("stddev: ", stddev.arraySync());
    console.log("reference position: ", reference_position.arraySync());
}

// generates random normally distributed values for alpha
export function generateAlpha() {
    alpha = new Array;
    for (let i = 0; i < variance.shape; i++) {
        alpha.push(normalDistribution());
    }
    alpha = tf.tensor(alpha);
}

// updates the shape vector with given alpha user inputs
export function updateAlpha() {
    alpha = tf.buffer(alpha.shape, alpha.dtype, alpha.dataSync());
    alpha.set(variance_scale, pca_index);
    alpha = alpha.toTensor();
    s = mean.add(Q.dot(alpha));

    console.log("alpha input: ", alpha.arraySync());
    return s.arraySync();
}

// debugging function that inverts the formula s = mean + Q*alpha -> alpha = Q_inv*(s - mean)
export function alphaFromS() {
    Q = Math.matrix(Q.arraySync());
    let Q_inv = Math.pinv(Q);
    Q_inv = tf.tensor(Q_inv._data);

    alpha = Q_inv.dot(s.sub(mean));
    console.log("alpha from s: ", alpha.arraySync());
}

// TODO: optimize code, e.g. .arraySync() for values at specific index suboptimal 
// calculates the posterior mean of the given model
export function computePosterior(model) {

    // get changed positions of model aka observations
    let changed_indices = new Array;
    const model_position = model.geometry.getAttribute('position').array;

    model_position[19748*3+2] += 1000;
    const model_old_pos = model.geometry.getAttribute('original_position').array;
    for (let i = 0; i < model_position.length; i+=3) {
        if (model_position[i] != model_old_pos[i] || model_position[i+1] != model_old_pos[i+1] || model_position[i+2] != model_old_pos[i+2]) {
            changed_indices.push(i);
            changed_indices.push(i+1);
            changed_indices.push(i+2);
        }
        model.userData.landmarks.forEach(landmark => {
            if (landmark.position[0] == model_position[i] || landmark.position[1] == model_position[i+1] || landmark.position[2] == model_position[i+2]) {
                changed_indices.push(i);
                changed_indices.push(i+1);
                changed_indices.push(i+2);
                return;
            }
        });
    }

    // select those elements and rows that correspond to the changed positions (observations)
    let s_g = new Array;
    let mean_g = new Array;
    let Q_g = new Array;
    changed_indices.forEach(changed_index => {
        s_g.push(s.arraySync()[changed_index]);
        mean_g.push(mean.arraySync()[changed_index]);
        Q_g.push(Q.arraySync()[changed_index]);
    });

    s_g = tf.tensor(s_g);
    mean_g = tf.tensor(mean_g);
    Q_g = tf.tensor(Q_g);

    let Q_gT = Q_g.transpose();
   
    let M = Q_gT.matMul(Q_g);
    M = M.add(tf.diag(variance));

    // calculating (pseudo) inverse is not implemented in tensorflow.js -> Math.js
    M = Math.matrix(M.arraySync());
    let M_inverse = Math.inv(M);
    M_inverse = tf.tensor(M_inverse._data);
    
    let mean_coeffs = M_inverse.matMul(Q_gT).dot(s_g.sub(mean_g));
    let posterior_mean = mean.add(Q.dot(mean_coeffs));

    console.log("mean: ", JSON.stringify(mean.arraySync()));
    console.log("posterior_mean: ", JSON.stringify(posterior_mean.arraySync()));

    console.log(model_position[19748*3]);
    console.log(model_position[19748*3+1]);
    console.log(model_position[19748*3]+2);
    console.log(posterior_mean.arraySync()[19748*3]);
    console.log(posterior_mean.arraySync()[19748*3+1]);
    console.log(posterior_mean.arraySync()[19748*3]+2);

    return posterior_mean.arraySync();
  
}

// src: https://codepen.io/Sire404/pen/dyvYPBM
// Standard Normal variate using Box-Muller transform.
function normalDistribution(mean=0, stdev=1) {
    let u = 1 - Math.random(); //Converting [0,1) to (0,1)
    let v = Math.random();
    let z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.pi * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}
