# Interactive Creation and Modification of Statistical Shape Models

Load in your statistical shape model .h5 file and interactively change the shape and compute the posterior mean of the model.

https://maximilian-hahn.github.io/BA/

## Controls

- **Left Mouse Button:** move mouse to change camera angle around shape.
- **Mouse Wheel:** zooms in and out.
- **CTRL + LMB on shape:** selects the closest vertex to the clicked position.
  - **LMB on x-axis:** move mouse in screen's x-direction to move vertex along x-axis.
  - **LMB on y-axis:** move mouse in screen's y-direction to move vertex along y-axis.
  - **LMB on z-axis:** move mouse in screen's x-direction to move vertex along z-axis.
  - **CTRL + LMB on background:** removes the selection again.
- **SHIFT + LMB on shape:** selects the closest landmark to the clicked position.

## Control Panel

- **show/hide vertices:** shows all vertices of the model as points to ease targeting a specific vertex or hides them again.
- **compute posterior:** triggers the computation of the posterior mean if at least one vertex of the shape has been modified. The modifed vertices are marked with green spheres, representing landmarks, and are the ones that are taken into account for the computation. The resulting posterior mean is shown as a shape.
- **scale principal components:** allows the scaling of the first ten principal components by changing the corresponding normally distributed alpha values in the range [-3,3]. The earlier principal components represent a higher variance in the model than the later ones, so scaling them modifies the shape more.
- **reset to mean shape:** shows the mean shape of the model by setting all alpha values to zero.
- **generate random shape:** computes a new shape by generating new random normally distributed alpha values to scale the principal components.
- **landmarks:**
  - **create/remove landmark:** if a vertex is marked creates a new landmark for it or removes the existing one.
  - **load landmarks:** loads the landmarks of the given .h5 model if it has any.
  - **remove all landmarks:** removes all existing landmarks.
- **settings:**
  - **vertex settings:**
    - **change marked (x,y,z):** changes the position of the marked vertex similarly to the mouse controls but offers higher precision because it allows typing specific float values.
    - **reset marked vertex to original position:** resets the position of the marked vertex to the original one and removes its landmark.
    - **reset all vertices to their original position:** resets the position of all changed vertices to their original one and removes all landmarks.
  - **light settings:** changes position and intensity of the directional light.
  - **camera settings:** flips the camera along the y axis or retargets the camera to the center of the mesh if that should not be the case for some reason.
  - **model color:** changes the color of the shape.
  - **scale objects:** scales the size of the landmarks and the vertex helper object.
- **export model as .ply file:** generates a link that can be clicked to download the current shape as a .ply file.

