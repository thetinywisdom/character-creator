import * as THREE from 'three';

/**
 * PS1 picture, then a cinematic finish: cold-blue grade, warm bloom on the
 * lamps and headlights, vignette, film grain. Motion blur is an average of
 * the dithered frames across the shutter (used on the fast bus shot).
 *
 * The grade samples the already-dithered image and writes it without a second
 * colour-space convert, so the 15-bit dither and outlines stay intact.
 */

const GRADE = {
  cold: new THREE.Vector3(0.86, 0.93, 1.12),
  warm: new THREE.Vector3(1.10, 0.97, 0.80),
  contrast: 1.05,
  lift: 0.02,
  vignette: 0.32,
  grain: 0.026,
  bloom: 0.5,
  threshold: 0.55,
};

function quadMaterial(fragment, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: fragment,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    ...extra,
  });
}

function target(w, h, type = THREE.UnsignedByteType) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type,
    depthBuffer: false,
    stencilBuffer: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
}

export function createFilmPresenter(renderer, ps1, { width, height }) {
  const frameRT = target(width, height);
  const accumRT = target(width, height, THREE.HalfFloatType);
  const bw = Math.max(2, Math.round(width / 4));
  const bh = Math.max(2, Math.round(height / 4));
  const bloomA = target(bw, bh, THREE.HalfFloatType);
  const bloomB = target(bw, bh, THREE.HalfFloatType);

  const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  scene.add(mesh);

  const addMat = quadMaterial(
    `precision highp float; uniform sampler2D tDiffuse; uniform float weight; varying vec2 vUv;
     void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb * weight, 1.0); }`,
    { tDiffuse: { value: null }, weight: { value: 1 } },
    {
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    },
  );

  const extractMat = quadMaterial(
    `precision highp float; uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
     void main() {
       vec3 c = texture2D(tDiffuse, vUv).rgb;
       float l = dot(c, vec3(0.299, 0.587, 0.114));
       float k = smoothstep(threshold, threshold + 0.35, l);
       gl_FragColor = vec4(c * k, 1.0);
     }`,
    { tDiffuse: { value: null }, threshold: { value: GRADE.threshold } },
  );

  const blurMat = quadMaterial(
    `precision highp float; uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv;
     void main() {
       vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227;
       c += texture2D(tDiffuse, vUv + dir * 1.0).rgb * 0.194;
       c += texture2D(tDiffuse, vUv - dir * 1.0).rgb * 0.194;
       c += texture2D(tDiffuse, vUv + dir * 2.0).rgb * 0.122;
       c += texture2D(tDiffuse, vUv - dir * 2.0).rgb * 0.122;
       c += texture2D(tDiffuse, vUv + dir * 3.0).rgb * 0.071;
       c += texture2D(tDiffuse, vUv - dir * 3.0).rgb * 0.071;
       gl_FragColor = vec4(c, 1.0);
     }`,
    { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
  );

  const gradeMat = quadMaterial(
    `precision highp float;
     uniform sampler2D tDiffuse; uniform sampler2D tBloom;
     uniform float frame, contrast, lift, vignette, grainAmt, bloomAmt;
     uniform vec3 cold; uniform vec3 warm;
     varying vec2 vUv;
     float hash(vec2 p) {
       return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
     }
     void main() {
       vec3 c = texture2D(tDiffuse, vUv).rgb;
       c = c * (1.0 - lift) + lift;
       float luma = dot(c, vec3(0.299, 0.587, 0.114));
       c *= mix(cold, warm, smoothstep(0.18, 0.78, luma));
       c = (c - 0.5) * contrast + 0.5;
       vec3 b = texture2D(tBloom, vUv).rgb;
       c += b * vec3(1.08, 0.94, 0.72) * bloomAmt;
       vec2 p = vUv * 2.0 - 1.0;
       p.x *= 0.78;
       float vig = smoothstep(1.22, 0.28, length(p));
       c *= mix(1.0 - vignette, 1.0, vig);
       float n = hash(gl_FragCoord.xy + vec2(frame * 19.0, frame * 47.0));
       c += (n - 0.5) * grainAmt;
       gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
     }`,
    {
      tDiffuse: { value: null },
      tBloom: { value: null },
      frame: { value: 0 },
      contrast: { value: GRADE.contrast },
      lift: { value: GRADE.lift },
      vignette: { value: GRADE.vignette },
      grainAmt: { value: GRADE.grain },
      bloomAmt: { value: GRADE.bloom },
      cold: { value: GRADE.cold },
      warm: { value: GRADE.warm },
    },
  );

  function pass(material, to, x, y, w, h) {
    mesh.material = material;
    renderer.setScissorTest(false);
    renderer.setRenderTarget(to);
    renderer.setViewport(x, y, w, h);
    renderer.render(scene, blitCam);
  }

  function bloomFrom(source) {
    extractMat.uniforms.tDiffuse.value = source.texture;
    pass(extractMat, bloomA, 0, 0, bw, bh);
    blurMat.uniforms.tDiffuse.value = bloomA.texture;
    blurMat.uniforms.dir.value.set(1.6 / bw, 0);
    pass(blurMat, bloomB, 0, 0, bw, bh);
    blurMat.uniforms.tDiffuse.value = bloomB.texture;
    blurMat.uniforms.dir.value.set(0, 1.6 / bh);
    pass(blurMat, bloomA, 0, 0, bw, bh);
    // a second, wider pass so the sodium halo is gentle rather than a tight rim
    blurMat.uniforms.tDiffuse.value = bloomA.texture;
    blurMat.uniforms.dir.value.set(3.2 / bw, 0);
    pass(blurMat, bloomB, 0, 0, bw, bh);
    blurMat.uniforms.tDiffuse.value = bloomB.texture;
    blurMat.uniforms.dir.value.set(0, 3.2 / bh);
    pass(blurMat, bloomA, 0, 0, bw, bh);
  }

  function grade(source, frameIndex) {
    bloomFrom(source);
    gradeMat.uniforms.tDiffuse.value = source.texture;
    gradeMat.uniforms.tBloom.value = bloomA.texture;
    gradeMat.uniforms.frame.value = frameIndex;
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    mesh.material = gradeMat;
    renderer.render(scene, blitCam);
  }

  /** One dithered PS1 frame of `stage` into frameRT. */
  function drawPs1(stage, camera) {
    renderer.autoClear = true;
    ps1.render(stage, camera, 0, 0, width, height, frameRT);
  }

  return {
    /** Single shutter. */
    render(stage, camera, frameIndex) {
      drawPs1(stage, camera);
      grade(frameRT, frameIndex);
    },

    /**
     * Average `samples` of already-dithered frames. The caller seeks the world
     * (and redraws via drawInto) for each subframe.
     */
    accumulate(samples, frameIndex) {
      renderer.setRenderTarget(accumRT);
      renderer.setClearColor(0x000000, 1);
      renderer.clear();
      const weight = 1 / samples.length;
      for (let i = 0; i < samples.length; i++) {
        samples[i](); // draws the PS1 picture into frameRT (and turns autoClear back on)
        renderer.autoClear = false;
        addMat.uniforms.tDiffuse.value = frameRT.texture;
        addMat.uniforms.weight.value = weight;
        pass(addMat, accumRT, 0, 0, width, height);
      }
      renderer.autoClear = true;
      grade(accumRT, frameIndex);
    },

    drawPs1,

    black() {
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
    },
  };
}
