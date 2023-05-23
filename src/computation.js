import * as tf from '@tensorflow/tfjs';
import * as Math from 'mathjs';
import { Matrix } from 'ml-matrix';
const {inverse, pseudoInverse} = require('ml-matrix');

/**
 *  the math for posterior shape models is based on the paper:
 *  Albrecht, T. et al. "Posterior shape models" Medical Image Analysis 17 (2013) 959–973
 */
 
let mean;               // mean of current model
                        // saved as absolute positions
let Q;                  // matrix containing principal components in each column * standard deviation
                        // principal components saved as deformations
let variance;           // variance or sigma^2 of above matrix; earlier components have a higher variance
                        // first value in order of 100,000 
let stddev;             // sigma or sqrt(variance)
export let alpha;       // coefficients for principal component matrix Q that follow a standard normal distribution
                        // values in range [-3;3]
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
export function updateAlpha(value, index) {
    alpha = tf.buffer(alpha.shape, alpha.dtype, alpha.dataSync());
    alpha.set(value, index);
    alpha = alpha.toTensor();

    s = mean.add(Q.dot(alpha)); // corresponds to formula (1) in the paper

    return s.arraySync();
}

// debugging function that inverts the formula s = mean + Q*alpha -> alpha = Q_inv*(s - mean)
export function alphaFromS() {
    // pseudo inverse using Math.js
    // let Q_inv = Math.pinv(Math.matrix(Q.arraySync()));
    // Q_inv = tf.tensor(Q_inv._data);

    // pseudo inverse using ml-matrix (better performance than Math.js)
    let Q_inv = pseudoInverse(new Matrix(Q.arraySync()));
    Q_inv = tf.tensor(Q_inv.to2DArray());

    console.log("alpha before: ", alpha.arraySync());
    alpha = Q_inv.dot(s.sub(mean));
    console.log("alpha from s: ", alpha.arraySync());
    s = mean.add(Q.dot(alpha));
    return s.arraySync();
}

export function alphaFromObservations() {
    // get changed positions of model aka observations
    let changed_indices = new Array;
    const nose_tip_id = 8156 * 3;
    changed_indices.push(nose_tip_id);
    changed_indices.push(nose_tip_id+1);
    changed_indices.push(nose_tip_id+2);
    
    console.log("prior position of nose tip");
    console.log(s.arraySync()[nose_tip_id]);
    console.log(s.arraySync()[nose_tip_id+1]);
    console.log(s.arraySync()[nose_tip_id+2]);

    // select those elements and rows of s, mean and Q that correspond to the given observations
    // corresponds to formula (4) in the paper
    let s_g = new Array;
    let mean_g = new Array;
    let Q_g = new Array;
    changed_indices.forEach(changed_index => {
        s_g.push(s.arraySync()[changed_index] + 10);
        mean_g.push(mean.arraySync()[changed_index]);
        Q_g.push(Q.arraySync()[changed_index]);
    });
    s_g = tf.tensor(s_g);
    mean_g = tf.tensor(mean_g);
    Q_g = tf.tensor(Q_g);

    let Q_g_inv = pseudoInverse(new Matrix(Q_g.arraySync()));
    Q_g_inv = tf.tensor(Q_g_inv.to2DArray());

    console.log("alpha before: ", alpha.arraySync());
    alpha = Q_g_inv.dot(s_g.sub(mean_g));
    console.log("alpha from observations: ", alpha.arraySync());
    s = mean.add(Q.dot(alpha));

    console.log("posterior position of nose tip");
    console.log(s.arraySync()[nose_tip_id]);
    console.log(s.arraySync()[nose_tip_id+1]);
    console.log(s.arraySync()[nose_tip_id+2]);
    return s.arraySync();
}

// TODO: optimize code, e.g. .arraySync() for values at specific index suboptimal 
// calculates the posterior mean of the given model
export function computePosterior(model) {

    // get changed positions of model aka observations
    let changed_indices = new Array;
    const nose_tip_id = 8156 * 3;

    const model_position = model.geometry.getAttribute('position').array;
    model_position[nose_tip_id] += 10;  // manually added observation at the tip of the nose (bfm.h5 model)
    s = s.arraySync();
    s[nose_tip_id] += 10;
    s = tf.tensor(s);

    const model_old_pos = model.geometry.getAttribute('original_position').array;

    // save all coordinates of the changed vertex even if only one changed
    for (let i = 0; i < model_position.length; i+=3) {
        if (model_position[i] != model_old_pos[i] || model_position[i+1] != model_old_pos[i+1] || model_position[i+2] != model_old_pos[i+2]) {
            changed_indices.push(i);
            changed_indices.push(i+1);
            changed_indices.push(i+2);
        }
        // landmarks are also treated as observations
        model.userData.landmarks.forEach(landmark => {
            if (landmark.position[0] == model_position[i] || landmark.position[1] == model_position[i+1] || landmark.position[2] == model_position[i+2]) {
                changed_indices.push(i);
                changed_indices.push(i+1);
                changed_indices.push(i+2);
                return;
            }
        });
    }

    // select those elements and rows of s, mean and Q that correspond to the given observations
    // corresponds to formula (4) in the paper
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

    // corresponds to formula (10) in the paper
    let Q_gT = Q_g.transpose();
    let M = Q_gT.matMul(Q_g);
    M = M.add(tf.diag(variance));

    // calculating (pseudo) inverse is not implemented in tensorflow.js -> switch data types to ml-matrix and back
    let M_inv = inverse(new Matrix(M.arraySync()));
    M_inv = tf.tensor(M_inv.to2DArray());
    
    let posterior_mean = mean.add(Q.dot(M_inv.dot(Q_gT.dot(s_g.sub(mean_g))))); // corresponds to formula (12) in the paper

    console.log("mean: ", JSON.stringify(mean.arraySync()));
    console.log("posterior_mean: ", JSON.stringify(posterior_mean.arraySync()));

    console.log("prior position of nose tip");
    console.log(model_position[nose_tip_id]);
    console.log(model_position[nose_tip_id+1]);
    console.log(model_position[nose_tip_id+2]);
    console.log("posterior position of nose tip");
    console.log(posterior_mean.arraySync()[nose_tip_id]);
    console.log(posterior_mean.arraySync()[nose_tip_id+1]);
    console.log(posterior_mean.arraySync()[nose_tip_id+2]);
    console.log("prior position of neighboring point");
    console.log(model_position[nose_tip_id+3]);
    console.log(model_position[nose_tip_id+4]);
    console.log(model_position[nose_tip_id+5]);
    console.log("posterior position of neighboring point");
    console.log(posterior_mean.arraySync()[nose_tip_id+3]);
    console.log(posterior_mean.arraySync()[nose_tip_id+4]);
    console.log(posterior_mean.arraySync()[nose_tip_id+5]);

    // posterior mean can be displayed as a mesh
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
