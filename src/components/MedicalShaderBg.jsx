import { useEffect, useRef } from 'react'

/**
 * WebGL Shader Background — Medical Palette
 * Procedural layered flow noise blending #f5fbf7, soft sage, deeper teal, and subtle ink.
 */
export default function MedicalShaderBg() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let gl = null
    try {
      gl = canvas.getContext('webgl', { powerPreference: 'low-power', alpha: false }) ||
           canvas.getContext('experimental-webgl')
    } catch {
      gl = null
    }

    if (!gl) {
      canvas.style.background = '#f5fbf7'
      return
    }

    let animationFrameId
    let isCleanedUp = false

    function resize() {
      if (!canvas || !gl) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.floor(window.innerWidth * dpr)
      const h = Math.floor(window.innerHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
    }

    window.addEventListener('resize', resize)
    resize()

    const vertSrc = `
      attribute vec2 a_pos;
      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `

    // Fragment shader: layered flow noise blended between palette tones,
    // derived from #f5fbf7 (background) and #171d1b (ink) plus two
    // in-between sage/teal steps for depth.
    const fragSrc = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      vec2 hash(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }

      float noise(vec2 p) {
        const float K1 = 0.366025404;
        const float K2 = 0.211324865;
        vec2 i = floor(p + (p.x + p.y) * K1);
        vec2 a = p - i + (i.x + i.y) * K2;
        vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0 * K2;
        vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
        vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
        return dot(n, vec3(70.0));
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          v += amp * noise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.09;

        vec2 flow = vec2(
          fbm(p * 1.3 + vec2(t, -t * 0.6)),
          fbm(p * 1.3 + vec2(-t * 0.5, t))
        );

        float n1 = fbm(p * 1.6 + flow * 1.4 + t * 0.35);
        float n2 = fbm(p * 2.3 - flow * 0.9 - t * 0.5 + 4.0);
        float n = n1 * 0.6 + n2 * 0.4;
        n = n * 0.5 + 0.5;

        // Palette, derived from the site tokens:
        vec3 bgLight   = vec3(0.961, 0.984, 0.969); // #f5fbf7
        vec3 sage      = vec3(0.859, 0.933, 0.882); // soft sage step
        vec3 teal      = vec3(0.663, 0.827, 0.749); // deeper teal step
        vec3 ink       = vec3(0.090, 0.114, 0.106); // #171d1b, used only as a whisper

        vec3 col = mix(bgLight, sage, smoothstep(0.18, 0.62, n));
        col = mix(col, teal, smoothstep(0.48, 0.92, n) * 0.7);

        // vignette that breathes slightly with the noise field instead of
        // sitting static, still capped low so it never reads as a dark corner
        float vignette = smoothstep(1.35, 0.2, length(p));
        float ripple = 0.04 + 0.02 * sin(t * 1.3 + n * 3.0);
        col = mix(col, ink, (1.0 - vignette) * ripple);

        gl_FragColor = vec4(col, 1.0);
      }
    `

    function compile(type, src) {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[MedicalShaderBg] Shader compile error:', gl.getShaderInfoLog(s))
      }
      return s
    }

    const vs = compile(gl.VERTEX_SHADER, vertSrc)
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc)
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[MedicalShaderBg] Program link error:', gl.getProgramInfoLog(program))
      return
    }

    gl.useProgram(program)

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const resLoc = gl.getUniformLocation(program, 'u_resolution')
    const timeLoc = gl.getUniformLocation(program, 'u_time')

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()

    function render(now) {
      if (isCleanedUp || !gl) return
      const t = prefersReducedMotion ? 0 : (now - start) / 1000
      gl.uniform2f(resLoc, canvas.width, canvas.height)
      gl.uniform1f(timeLoc, t)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render)
      }
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      isCleanedUp = true
      window.removeEventListener('resize', resize)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      try {
        if (gl) {
          gl.deleteBuffer(buf)
          gl.deleteProgram(program)
          gl.deleteShader(vs)
          gl.deleteShader(fs)
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="bg"
      className="medical-shader-bg"
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
}
