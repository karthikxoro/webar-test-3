import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default function ARViewer() {
  const canvasRef = useRef();
  const [xrSupported, setXrSupported] = useState(false);
  const [modelUrl, setModelUrl] = useState(null);

  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then(setXrSupported);
    }
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.glb')) {
      const url = URL.createObjectURL(file);
      setModelUrl(url);
    } else {
      alert('Please upload a .glb file');
    }
  };

  const startAR = async () => {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local-floor']
    });

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      antialias: true,
      canvas: canvasRef.current,
    });

    renderer.xr.enabled = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const loader = new GLTFLoader();
    let loadedModel = null;

    // Load model
    loader.load(modelUrl, (gltf) => {
      loadedModel = gltf.scene;
      loadedModel.scale.set(0.5, 0.5, 0.5);
      loadedModel.visible = false;
      scene.add(loadedModel);
    });

    const reticleGeometry = new THREE.RingGeometry(0.1, 0.15, 32).rotateX(-Math.PI / 2);
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.visible = false;
    scene.add(reticle);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

    const referenceSpace = await session.requestReferenceSpace('local-floor');
    const viewerSpace = await session.requestReferenceSpace('viewer');
    const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    renderer.xr.setSession(session);

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      if (reticle.visible && loadedModel) {
        loadedModel.position.setFromMatrixPosition(reticle.matrix);
        loadedModel.visible = true;
      }
    });
    scene.add(controller);

    const onXRFrame = (time, frame) => {
      const session = renderer.xr.getSession();
      const pose = frame.getViewerPose(referenceSpace);

      if (pose) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const hitPose = hitTestResults[0].getPose(referenceSpace);
          if (hitPose) {
            reticle.visible = true;
            reticle.matrix.fromArray(hitPose.transform.matrix);
          }
        } else {
          reticle.visible = false;
        }
      }

      renderer.render(scene, camera);
      session.requestAnimationFrame(onXRFrame);
    };

    session.requestAnimationFrame(onXRFrame);

    session.addEventListener('end', () => {
      hitTestSource.cancel();
    });
  };

  return (
    <div>
      {!modelUrl ? (
        <div style={{ padding: 20 }}>
          <input type="file" accept=".glb" onChange={handleFileUpload} />
        </div>
      ) : xrSupported ? (
        <button onClick={startAR}>Start AR</button>
      ) : (
        <p>Your device does not support WebXR AR.</p>
      )}
      <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />
    </div>
  );
}
