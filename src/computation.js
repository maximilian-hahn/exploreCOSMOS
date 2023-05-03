import {variance_scale, pca_index} from './gui.js';
import * as tf from '@tensorflow/tfjs';
import * as Math from 'mathjs';

let mean;       // mean of prior model
let Q;          // matrix containing principal components
let variance;   // variance or sigma^2 of above matrix; earlier components have a higher variance
export let alpha;      // coefficients for principal component matrix Q that follow a standard normal distribution
let template_positions;

export function loadValues(file) {
    mean = tf.tensor(file.get('shape/model/mean').value);
    let pca_basis = file.get('shape/model/pcaBasis');
    Q = tf.tensor(Math.reshape(pca_basis.value, pca_basis.shape));
    template_positions = tf.tensor(file.get('shape/representer/points').value);
    
    // console.log("Q before : ");
    // console.log(Q.arraySync());
    // // add mean to every Q column
    // let Q_tmp = Q.transpose();
    // Q = Q_tmp.add(mean);
    // Q = Q.transpose();
    // console.log("Q after: ");
    // console.log(Q.arraySync());
    
    variance = tf.tensor(file.get('shape/model/pcaVariance').value);
    generateAlpha();
    console.log("alpha: ");
    console.log(alpha.arraySync());
}

export function generateAlpha() {
    alpha = new Array;
    for (let i = 0; i < variance.shape; i++) {
        alpha.push(normalDistribution());
    }
    alpha = tf.tensor(alpha);
}

export function updateAlpha() {
    alpha = tf.buffer(alpha.shape, alpha.dtype, alpha.dataSync());
    alpha.set(variance_scale, pca_index);
    alpha = alpha.toTensor();
    let s = mean.add(Q.dot(alpha.mul(variance).mul(0.005)));
    return s.arraySync();
}

// calculate the posterior mean of the given model and add it to the scene
export function computePosterior(model) {
    // get changed positions of model aka observations and update the mean
    let changed_indices = new Array;
    const model_position = model.geometry.getAttribute('position').array;
    const model_old_pos = model.geometry.getAttribute('original_position').array;
    mean = model_position;
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
    mean = tf.tensor(mean);
    // mean = mean.sub(template_positions);    // mean should be a deformation field?

    // math based on paper: Medical Image Analysis 17 (2013) 959–973
    let s = mean.add(Q.dot(alpha));  // s = mean + Q * alpha
    // s.print(); // dim: 5265 ~ 1

    // select those elements and rows that correspond to the changed positions (observations)
    let s_g = new Array;
    let mean_g = new Array;
    let Q_g = new Array;
    changed_indices.forEach(changed_index => {
        s_g.push(s.arraySync()[changed_index]);
        mean_g.push(mean.arraySync()[changed_index]);
        Q_g.push(Q.arraySync()[changed_index]);
    });
    // console.log("s_g: " + s_g);
    // console.log("mean_g: " + mean_g);
    // console.log("Q_g: " + Q_g);

    s_g = tf.tensor(s_g);
    mean_g = tf.tensor(mean_g);
    Q_g = tf.tensor(Q_g);

    // console.log("Q_g: ");
    // console.log(Q_g.arraySync());
    let Q_gT = Q_g.transpose();
  
  
    // computation for posterior mean
    
    // let WT = W.transpose();
    // WT.print();  // dim: 199 ~ 5265
    // let M = WT.matMul(W);
    // M = M.add(variance.dot(tf.eye(...M.shape))); // M = W^T * W + variance * I
    // console.log(M); // dim: 199 ~ 199
    // let M_inverse = tf.tensor(Math.inv(Math.matrix(M.arraySync())).toArray());
    // M_inverse.print();
    // let posterior_mean = M_inverse.matMul(WT).dot(x.sub(mean)); // M^-1 * W^T * (x - mean)
    // console.log(posterior_mean);
    // new formula: mean + W * M^-1 * W^T * (x - mean)
    // let WM = Math.multiply(W, M_inverse);
    // console.log(WM);
    // let posterior_mean = Math.multiply(Math.multiply(WM, WT), Math.subtract(x, mean));
    // console.log(posterior_mean);  // TODO: wrong dimension, 199 when it should have 5265
    // posterior_mean = Math.add(mean, posterior_mean);
   
    let M = Q_gT.matMul(Q_g).add(tf.diag(variance));
    // console.log(JSON.stringify(M.arraySync()));

    // console.log("M: ");
    // console.log(M.arraySync());

    // calculating pseudo inverse is not implemented in tensorflow.js -> Math.js
    // M = new Matrix(M.arraySync());
    // console.log("det: " + determinant(M));
    // M = inverse(M);
    M = Math.matrix(M.arraySync());
    // console.log("det: " + Math.det(M));
    let M_inverse = Math.inv(M);
    // console.log("det: " + det(M));
    // M = invertMatrix(M);
    // M = inverse(M.arraySync());

    M_inverse = tf.tensor(M_inverse._data);
    // console.log("M_inverse: ");
    // console.log(M_inverse.arraySync());
    // mean = mean.add(template_positions);
    let posterior_mean = mean.add(Q.dot(M_inverse.dot(Q_gT.dot(s_g.sub(mean_g)))));
    console.log("mean: ");
    console.log(JSON.stringify(mean.arraySync()));
    console.log("posterior_mean: ");
    console.log(JSON.stringify(posterior_mean.arraySync()));

    return posterior_mean.arraySync();
  
    // TODO: fix centering with centerMeshPosition
    // position_matrix = Math.reshape(Math.subtract(Math.matrix(template_points.value), x).toArray(), template_points.shape);
    // point_positions = centerMeshPosition(position_matrix);
  
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


// src: https://stackoverflow.com/questions/51805389/how-do-i-invert-a-matrix-in-tensorflow-js
// calculate the determinant of a matrix m
function det(m) {
    return tf.tidy(() => {
        const [r, _] = m.shape
        if (r === 2) {
            const t = m.as1D()
            const a = t.slice([0], [1]).dataSync()[0]
            const b = t.slice([1], [1]).dataSync()[0]
            const c = t.slice([2], [1]).dataSync()[0]
            const d = t.slice([3], [1]).dataSync()[0]
            let result = a * d - b * c
            return result

        } else {
            let s = 0;
            let rows = [...Array(r).keys()]
            for (let i = 0; i < r; i++) {
                let sub_m = m.gather(tf.tensor1d(rows.filter(e => e !== i), 'int32'))
                let sli = sub_m.slice([0, 1], [r - 1, r - 1])
                s += Math.pow(-1, i) * det(sli)
            }
            return s
        }
    })
}

function inverse(_A) {
    var temp,
    N = _A.length,
    E = [];
   
    for (var i = 0; i < N; i++)
      E[i] = [];
   
    for (i = 0; i < N; i++)
      for (var j = 0; j < N; j++) {
        E[i][j] = 0;
        if (i == j)
          E[i][j] = 1;
      }
   
    for (var k = 0; k < N; k++) {
      temp = _A[k][k];
   
      for (var j = 0; j < N; j++)
      {
        _A[k][j] /= temp;
        E[k][j] /= temp;
      }
   
      for (var i = k + 1; i < N; i++)
      {
        temp = _A[i][k];
   
        for (var j = 0; j < N; j++)
        {
          _A[i][j] -= _A[k][j] * temp;
          E[i][j] -= E[k][j] * temp;
        }
      }
    }
   
    for (var k = N - 1; k > 0; k--)
    {
      for (var i = k - 1; i >= 0; i--)
      {
        temp = _A[i][k];
   
        for (var j = 0; j < N; j++)
        {
          _A[i][j] -= _A[k][j] * temp;
          E[i][j] -= E[k][j] * temp;
        }
      }
    }
   
    for (var i = 0; i < N; i++)
      for (var j = 0; j < N; j++)
        _A[i][j] = E[i][j];
    return _A;
  }

// src: https://stackoverflow.com/questions/51805389/how-do-i-invert-a-matrix-in-tensorflow-js
// calculate the inverse of the matrix : jordan-gauss method
export function invertMatrix(m) {
    return tf.tidy(() => {
        if (det(m) === 0) {
            return
        }
        console.log("det not zero")
        const [r, _] = m.shape
        let inv = m.concat(tf.eye(r), 1)
        let rows = [...Array(r).keys()]
        for (let i = 0; i < r; i++) {
            inv = tf.tidy(() => {
                for (let j = i + 1; j < r; j++) {
                    const elt = inv.slice([j, i], [1, 1]).as1D().asScalar()
                    const pivot = inv.slice([i, i], [1, 1]).as1D().asScalar()
                    let newrow
                    if (elt.dataSync()[0] !== 0) {
                        newrow = inv.gather(tf.tensor1d([i], 'int32')).sub(inv.gather(tf.tensor1d([j], 'int32')).div(elt).mul(pivot)).as1D()
                        const sli = inv.gather(rows.filter(e => e !== j))
                        const arr = []
                        if (j === 0) {
                            arr.push(newrow)
                        }
                        sli.unstack().forEach((t, ind) => {
                            if (ind !== j) {
                                arr.push(t)
                            } else {
                                arr.push(newrow)
                                arr.push(t)
                            }
                        })
                        if (j === r - 1) {
                            arr.push(newrow)
                        }
                        inv = tf.stack(arr)
                    }
                }
                return inv
            })
        }
        const trian = tf.unstack(inv)
        let len = trian.length
        trian[len - 1] = trian[len - 1].div(trian[len - 1].slice(trian[len - 1].shape[0] - 1, 1).asScalar())
        for (let i = r - 2; i > -1; i--) {
            for (j = r - 1; j > i; j--) {
                trian[i] = trian[i].sub(trian[j].mul(trian[i].slice(j, 1).asScalar()))
            }
            trian[i] = trian[i].div(trian[i].slice(i, 1).asScalar())
        }
        return tf.split(tf.stack(trian), 2, 1)[1]
    })
}