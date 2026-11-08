import * as THREE from 'three';

// The PS1 render step, for the app and for games. A scene is rendered into a
// small target (screen size / style.pixelScale), then drawn back to the screen
// scaled up with hard pixels, reduced to 15-bit colour with a 4x4 ordered
// dither, and given 1-pixel dark outlines where shapes overlap.
//
//   const ps1 = createPs1Renderer(renderer);
//   ps1.render(stage, camera, x, y, w, h);  // stage = { scene, style }, x / y from bottom-left
//
// `stage.rt` is created on first use (one low-res target per stage). The
// depth buffer is 24-bit: 16-bit was too coarse and made close surfaces flicker.

export function createPs1Renderer(renderer) {
  const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null }, tDepth: { value: null }, size: { value: new THREE.Vector2(1, 1) },
      dither: { value: 1 }, outline: { value: 0 }, near: { value: 0.1 }, far: { value: 100 }, ortho: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      #include <packing>
      uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 size;
      uniform float dither; uniform float outline; uniform float near; uniform float far; uniform float ortho;
      varying vec2 vUv;
      float viewDepth(vec2 uv) {
        float z = texture2D(tDepth, uv).x;
        return ortho > 0.5 ? -orthographicDepthToViewZ(z, near, far) : -perspectiveDepthToViewZ(z, near, far);
      }
      float bayer4(vec2 p) {
        int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
        int i = x + y * 4;
        int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
        return float(m[i]) / 16.0;
      }
      void main() {
        vec4 c = linearToOutputTexel(texture2D(tDiffuse, vUv));
        if (outline > 0.5) {
          // Silhouette test: 1/depth changes linearly across a flat surface, so
          // its second difference is ~0 on floors and walls and large where a
          // shape sits in front of something else. Only the nearer pixel darkens.
          vec2 t = 1.0 / size;
          float d = viewDepth(vUv);
          float l = viewDepth(vUv - vec2(t.x, 0.0)), r = viewDepth(vUv + vec2(t.x, 0.0));
          float dn = viewDepth(vUv - vec2(0.0, t.y)), up = viewDepth(vUv + vec2(0.0, t.y));
          float ic = 1.0 / d;
          float lap = abs(1.0 / l + 1.0 / r - 2.0 * ic) + abs(1.0 / dn + 1.0 / up - 2.0 * ic);
          float farthest = max(max(l, r), max(dn, up));
          if (lap > ic * 0.12 && farthest > d * 1.02) c.rgb *= 0.28;
        }
        if (dither > 0.5) {
          vec2 px = floor(vUv * size);
          c.rgb += (bayer4(px) - 0.5) / 31.0;
          c.rgb = floor(clamp(c.rgb, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
        }
        gl_FragColor = c;
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const blitScene = new THREE.Scene();
  blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));

  /** Draw `stage` ({ scene, style }) with `camera` into the screen rectangle (x, y from bottom-left). */
  function render(stage, camera, x, y, w, h) {
    const scale = stage.style.pixelScale;
    renderer.setScissorTest(true);
    if (!scale) {
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      renderer.render(stage.scene, camera);
      return;
    }
    const lw = Math.max(1, Math.round(w / scale)), lh = Math.max(1, Math.round(h / scale));
    stage.rt ??= new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    if (stage.rt.width !== lw || stage.rt.height !== lh) stage.rt.setSize(lw, lh);
    stage.style.prepareRender?.(lw, lh);
    renderer.setRenderTarget(stage.rt);
    renderer.render(stage.scene, camera);
    renderer.setRenderTarget(null);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    const u = blitMat.uniforms;
    u.tDiffuse.value = stage.rt.texture;
    u.size.value.set(lw, lh);
    u.tDepth.value = stage.rt.depthTexture;
    u.dither.value = stage.style.dither === false ? 0 : 1;
    u.outline.value = stage.style.outline ? 1 : 0;
    u.near.value = camera.near;
    u.far.value = camera.far;
    u.ortho.value = camera.isOrthographicCamera ? 1 : 0;
    renderer.render(blitScene, blitCam);
  }

  return { render };
}
