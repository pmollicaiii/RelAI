// RelAI V1 — WaterOrb: Three.js 3D glass sphere with volumetric churning water interior
// Uses a raymarched 3D fbm in fragment shader for the water body,
// and a Fresnel + refraction shader for the outer glass shell.

(function () {
  const THREE = window.THREE;
  if (!THREE) {
    console.error("[orb3d] Three.js not loaded");
    return;
  }

  // =========================================================================
  // Shaders
  // =========================================================================

  // ---------- Water interior (volumetric raymarch) ----------
  // Object-space ray-march. Sphere is at origin with radius 1 in object space.
  // The vertex shader provides both the entry point (vObjPos, on the sphere surface)
  // and the object-space view direction via uCamObj.
  const waterVert = /* glsl */ `
    uniform vec3 uCamObj;           // camera position in object space
    varying vec3 vObjPos;           // object-space position (|vObjPos| == 1)
    varying vec3 vObjViewDir;       // object-space view direction
    varying vec3 vNormalW;
    varying vec3 vViewDirW;
    void main() {
      vObjPos = position;
      vObjViewDir = normalize(position - uCamObj);

      vNormalW = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vViewDirW = normalize(wp.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const waterFrag = /* glsl */ `
    precision highp float;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec3  uDeep;
    uniform vec3  uMid;
    uniform vec3  uBright;
    uniform vec3  uRim;
    varying vec3 vObjPos;
    varying vec3 vObjViewDir;
    varying vec3 vNormalW;
    varying vec3 vViewDirW;

    // 3D simplex-ish hash noise
    vec3 hash3(vec3 p) {
      p = vec3(dot(p, vec3(127.1,311.7, 74.7)),
               dot(p, vec3(269.5,183.3,246.1)),
               dot(p, vec3(113.5,271.9,124.6)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }
    float noise3(vec3 p) {
      vec3 i = floor(p); vec3 f = fract(p);
      vec3 u = f*f*(3.0-2.0*f);
      return mix(mix(mix(dot(hash3(i+vec3(0,0,0)), f-vec3(0,0,0)),
                         dot(hash3(i+vec3(1,0,0)), f-vec3(1,0,0)), u.x),
                     mix(dot(hash3(i+vec3(0,1,0)), f-vec3(0,1,0)),
                         dot(hash3(i+vec3(1,1,0)), f-vec3(1,1,0)), u.x), u.y),
                 mix(mix(dot(hash3(i+vec3(0,0,1)), f-vec3(0,0,1)),
                         dot(hash3(i+vec3(1,0,1)), f-vec3(1,0,1)), u.x),
                     mix(dot(hash3(i+vec3(0,1,1)), f-vec3(0,1,1)),
                         dot(hash3(i+vec3(1,1,1)), f-vec3(1,1,1)), u.x), u.y), u.z);
    }

    float fbm(vec3 p) {
      float v = 0.0; float a = 0.5;
      // Shear the space to break up axis alignment — makes churn organic
      mat3 m = mat3( 0.00, 1.60, 1.20,
                    -1.60, 0.72,-0.96,
                    -1.20,-0.96, 1.28);
      for (int i = 0; i < 5; i++) {
        v += a * noise3(p);
        p = m * p;
        a *= 0.5;
      }
      return v;
    }

    // Water density function — time-warped fbm with flow
    float density(vec3 p) {
      float t = uTime * (0.28 + 0.55 * uIntensity);
      // Rising/falling flow — warp the sample by a slower noise
      vec3 q = p + 0.55 * vec3(
        fbm(p * 1.6 + vec3(0.0, t*0.9, 0.0)),
        fbm(p * 1.6 + vec3(3.2, t*0.7, 1.1)),
        fbm(p * 1.6 + vec3(1.7, 0.0, t*0.8))
      );
      // Swirl: rotate q about Y axis based on radius (differential rotation — feels like churn)
      float r = length(p);
      float a = t * (0.9 + 1.1 * uIntensity) + r * 2.4;
      float c = cos(a), s = sin(a);
      q.xz = mat2(c, -s, s, c) * q.xz;
      return fbm(q * 1.3 + vec3(0.0, -t * 1.2, 0.0));
    }

    // Raymarch the interior of a unit sphere in object space.
    // Entry = surface point; direction = refracted view.
    vec4 marchWater(vec3 ro, vec3 rd) {
      // Intersect ray with unit sphere to find exit t
      float b = dot(ro, rd);
      float c = dot(ro, ro) - 1.0;
      float h = b*b - c;
      if (h < 0.0) return vec4(0.0);
      float tExit = -b + sqrt(h);
      tExit = clamp(tExit, 0.0, 2.0);

      const int STEPS = 28;
      float dt = tExit / float(STEPS);
      vec3 col = vec3(0.0);
      float alpha = 0.0;

      for (int i = 0; i < STEPS; i++) {
        float t = (float(i) + 0.5) * dt;
        vec3 p = ro + rd * t;
        float rr = dot(p, p);
        if (rr > 1.0) break;

        float d = density(p * 1.55);
        // Shape into bright sheets — like churning water with bright foam
        float sheet = smoothstep(-0.05, 0.55, d);
        sheet *= (1.0 - rr * 0.55); // fade toward shell edges

        // Depth-based tint: deeper along ray = darker blue
        float depthMix = float(i) / float(STEPS);
        vec3 base = mix(uBright, uMid, depthMix);
        base = mix(base, uDeep, smoothstep(0.4, 1.0, depthMix));

        // Highlight where density is high (foam-like)
        float foam = smoothstep(0.55, 0.95, d) * (1.0 - depthMix * 0.7);
        vec3 samp = base * (0.45 + 1.9 * sheet) + vec3(1.0, 1.0, 1.05) * foam * (0.95 + 0.7 * uIntensity);

        float aStep = sheet * (0.24 + 0.2 * uIntensity);
        // Front-to-back compositing
        col += (1.0 - alpha) * samp * aStep;
        alpha += (1.0 - alpha) * aStep;
        if (alpha > 0.97) break;
      }

      return vec4(col, alpha);
    }

    void main() {
      // Object-space ray origin = entry point on sphere (|vObjPos| = 1)
      // Push a hair inside
      vec3 ro = vObjPos - vObjViewDir * 0.001;
      vec3 rd = vObjViewDir;

      vec4 water = marchWater(ro, rd);

      // Rim light in world space — grazing angles get a cool blue halo
      float fres = pow(1.0 - max(dot(normalize(vNormalW), -vViewDirW), 0.0), 3.0);
      vec3 rim = uRim * fres * 1.1;

      vec3 col = water.rgb + rim * (0.5 + 0.5 * water.a);
      float a = clamp(water.a + fres * 0.35, 0.0, 1.0);
      gl_FragColor = vec4(col, a);
    }
  `;

  // ---------- Glass shell (Fresnel + fake refraction) ----------
  const glassVert = /* glsl */ `
    varying vec3 vNormalW;
    varying vec3 vViewDirW;
    varying vec2 vUv;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewDirW = normalize(wp.xyz - cameraPosition);
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const glassFrag = /* glsl */ `
    precision highp float;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec3  uRim;
    varying vec3 vNormalW;
    varying vec3 vViewDirW;
    varying vec2 vUv;

    void main() {
      vec3 N = normalize(vNormalW);
      vec3 V = -vViewDirW;
      float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);

      // Specular highlight: a light from upper-left
      vec3 L = normalize(vec3(-0.55, 0.75, 0.6));
      float spec = pow(max(dot(reflect(-L, N), V), 0.0), 48.0);
      // secondary light from upper-right
      vec3 L2 = normalize(vec3(0.6, 0.5, 0.8));
      float spec2 = pow(max(dot(reflect(-L2, N), V), 0.0), 120.0) * 0.8;

      // Caustic shimmer on the surface — thin moving light bands
      float c = sin(vUv.x * 22.0 + uTime * 1.4)
              * sin(vUv.y * 18.0 - uTime * 1.1);
      c = smoothstep(0.55, 0.95, c) * (0.2 + 0.3 * fres);

      vec3 col = uRim * fres * 1.2;
      col += vec3(1.0) * spec * (1.0 + 0.6 * uIntensity);
      col += vec3(0.75, 0.9, 1.0) * spec2;
      col += vec3(0.8, 0.95, 1.15) * c;

      float a = clamp(fres * 0.85 + spec + spec2 * 0.6 + c * 0.5, 0.0, 1.0);
      gl_FragColor = vec4(col, a);
    }
  `;

  // =========================================================================
  // Component
  // =========================================================================
  function WaterOrb({ listening }) {
    const mountRef = React.useRef(null);
    const stateRef = React.useRef(null);
    const listeningRef = React.useRef(false);

    React.useEffect(() => {
      listeningRef.current = !!listening;
    }, [listening]);

    React.useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      const w = mount.clientWidth || 240;
      const h = mount.clientHeight || 240;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 50);
      camera.position.set(0, 0, 4.6);

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      // --- Solid dark backing sphere — gives the water volume contrast to read against ---
      const backingGeo = new THREE.SphereGeometry(0.985, 48, 48);
      const backingMat = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main(){
            vN = normalize(normalMatrix * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vV = normalize(wp.xyz - cameraPosition);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: `
          precision highp float;
          varying vec3 vN; varying vec3 vV;
          void main(){
            // Deep blue sphere shaded from upper-left light, dark on bottom-right
            vec3 L = normalize(vec3(-0.4, 0.7, 0.6));
            float lambert = max(dot(normalize(vN), L), 0.0);
            vec3 deep = vec3(0.02, 0.05, 0.16);
            vec3 mid  = vec3(0.06, 0.18, 0.45);
            vec3 col = mix(deep, mid, lambert);
            // bottom rim pickup — cool reflected light
            float botRim = pow(max(-vN.y, 0.0), 2.0);
            col += vec3(0.08, 0.22, 0.45) * botRim * 0.7;
            gl_FragColor = vec4(col, 1.0);
          }`,
        transparent: false,
        depthWrite: true,
      });
      const backingMesh = new THREE.Mesh(backingGeo, backingMat);
      scene.add(backingMesh);

      // --- Water sphere (inner, volumetric) ---
      const waterGeo = new THREE.SphereGeometry(1.0, 64, 64);
      const waterUniforms = {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uCamObj: { value: new THREE.Vector3() },
        uDeep: { value: new THREE.Color("#0a1f55") },
        uMid: { value: new THREE.Color("#2d7bde") },
        uBright: { value: new THREE.Color("#7cc4ff") },
        uRim: { value: new THREE.Color("#a8dcff") },
      };
      const waterMat = new THREE.ShaderMaterial({
        vertexShader: waterVert,
        fragmentShader: waterFrag,
        uniforms: waterUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      scene.add(waterMesh);

      // --- Glass shell (outer, slightly larger, additive highlights) ---
      const glassGeo = new THREE.SphereGeometry(1.02, 64, 64);
      const glassUniforms = {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uRim: { value: new THREE.Color("#a8d8ff") },
      };
      const glassMat = new THREE.ShaderMaterial({
        vertexShader: glassVert,
        fragmentShader: glassFrag,
        uniforms: glassUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      scene.add(glassMesh);

      // Resize handler
      const ro = new ResizeObserver(() => {
        const w2 = mount.clientWidth || 240;
        const h2 = mount.clientHeight || 240;
        renderer.setSize(w2, h2, false);
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
      });
      ro.observe(mount);

      // Reusable scratch for camera-in-object-space
      const _camObj = new THREE.Vector3();
      const _invMat = new THREE.Matrix4();

      // Animate
      let raf = 0;
      const t0 = performance.now();
      let intensity = 0;
      function tick() {
        raf = requestAnimationFrame(tick);
        try {
          const t = (performance.now() - t0) / 1000;
          const target = listeningRef.current ? 1.0 : 0.0;
          intensity += (target - intensity) * 0.08;

          waterUniforms.uTime.value = t;
          waterUniforms.uIntensity.value = intensity;
          glassUniforms.uTime.value = t;
          glassUniforms.uIntensity.value = intensity;

          // Gentle auto-rotation for 3D sell
          const spin = 0.06 + 0.32 * intensity;
          waterMesh.rotation.y = t * spin;
          waterMesh.rotation.x = Math.sin(t * 0.3) * 0.12;
          glassMesh.rotation.copy(waterMesh.rotation);
          backingMesh.rotation.copy(waterMesh.rotation);

          // Compute camera position in water-mesh's object space for the raymarch
          waterMesh.updateMatrixWorld(true);
          _invMat.copy(waterMesh.matrixWorld).invert();
          _camObj.copy(camera.position).applyMatrix4(_invMat);
          waterUniforms.uCamObj.value.copy(_camObj);

          renderer.render(scene, camera);
        } catch (e) {
          console.error("[orb3d] tick error:", e);
          cancelAnimationFrame(raf);
        }
      }
      tick();

      stateRef.current = { renderer, scene, waterMat, glassMat, waterGeo, glassGeo };

      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        waterGeo.dispose();
        glassGeo.dispose();
        backingGeo.dispose();
        waterMat.dispose();
        glassMat.dispose();
        backingMat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode)
          renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    }, []);

    return <div ref={mountRef} className="orb-3d-mount" />;
  }

  window.WaterOrb = WaterOrb;
})();
