// WebGL scenes. Each one is a single full-screen shader that casts a ray per pixel from the
// camera (so you can look around in 3D) and shades it from the sound.
//
//   tunnel    the music world: a kaleidoscopic polygon tunnel you fly through
//   sky       the Hibernation room: a dome of slow light built from your surroundings

const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

const COMMON = `precision highp float;
uniform vec2 R;uniform mat3 M;uniform float T,bass,mid,high,beat,flash;
uniform vec3 glow;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec3 ray(float kick){
  vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);
  uv*=1.-kick;
  return M*normalize(vec3(uv,1.));
}
`;

const TUNNEL = COMMON + `
uniform float trav,N,fk;uniform vec3 pa,pb,pd;
vec3 pal(float t){return pa+pb*cos(6.28318*(t+pd));}
void main(){
  vec3 d=ray(beat*.06);                          // the world kicks toward you on each beat
  float lxy=length(d.xy), ad=max(abs(d.z),.002);
  float r=lxy/ad;                                // distance from the vanishing point
  float front=d.z>0.?1.:.45;                     // the far end ahead is brighter than behind you
  float a=atan(d.y,d.x)+T*.035;
  a+=(.4/(r+.015))*(.04+mid*.05);                // twist deeper = more spiral
  float s=6.28318/N;
  float fa=abs(mod(a,s)-s*.5);                   // fold into one mirrored sector
  float rp=lxy*cos(fa);                          // polygon-shaped tunnel walls
  float z=.4*d.z/(rp+.015*ad+1e-4)+trav;         // depth along the tunnel (negative = behind)
  float ang=fa/s;
  vec2 q=vec2(ang*2.,abs(fract(z*.25)-.5)*4.-1.)*1.3;
  float acc=0.,k=.72+fk+bass*.22;
  for(int i=0;i<6;i++){q=abs(q)/clamp(dot(q,q),.12,1.5)-k;acc+=exp(-7.*abs(q.x*q.y));}
  float g=abs(fract(z)-.5);
  float ring=smoothstep(.45,.5,g)*(.25+high*1.4+beat*1.2);
  float spoke=smoothstep(.006,0.,(s*.5-fa)*min(r,4.))*(.7+beat*.8);
  vec2 sc=vec2(ang*40.,z*8.);
  float hs=h21(vec2(floor(sc.x),mod(floor(sc.y),512.))+N);
  float star=step(.94,hs)*smoothstep(.45,0.,length(fract(sc)-.5))*(.6+high*2.5);
  vec3 col=pal(acc*.08+z*.03+T*.02)*acc*.2;
  col+=pal(.3+z*.05)*ring+pal(.6)*spoke;
  col+=vec3(1.,.92,1.)*star;
  col*=mix(.3,1.,smoothstep(0.,.35,r));
  col+=pal(.1)*exp(-r*7.)*(.35+mid*1.6)*front;   // the vanishing-point glow
  col+=glow*exp(-r*3.)*(.12+beat*.35)*front;     // lit by the chakra the music is hitting
  col*=1.+bass*.7+beat*.25;
  col=1.-exp(-col*1.25);
  col=mix(col,vec3(1.),flash);
  gl_FragColor=vec4(col,1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export function createRenderer(canvas, extraScenes = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL is not available');
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vs = compile(gl, gl.VERTEX_SHADER, VS);

  const programs = {};
  for (const [name, fs] of Object.entries({ tunnel: TUNNEL, ...extraScenes })) {
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs)); // extra scenes start with COMMON
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const uniforms = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      uniforms[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(prog, info.name), type: info.type, size: info.size };
    }
    programs[name] = { prog, uniforms, loc: gl.getAttribLocation(prog, 'p') };
  }

  let scale = Math.min(devicePixelRatio || 1, 1.5) * 0.75; // keeps phones smooth and cool
  function resize() {
    canvas.width = (innerWidth * scale) | 0;
    canvas.height = (innerHeight * scale) | 0;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  addEventListener('resize', resize);
  resize();

  function set(u, v) {
    if (!u) return;
    switch (u.type) {
      case gl.FLOAT: u.size > 1 ? gl.uniform1fv(u.loc, v) : gl.uniform1f(u.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
      default: break;
    }
  }

  return {
    gl,
    setScale(s) { scale = s; resize(); },
    draw(name, values) {
      const p = programs[name];
      gl.useProgram(p.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(p.loc);
      gl.vertexAttribPointer(p.loc, 2, gl.FLOAT, false, 0, 0);
      set(p.uniforms.R, [canvas.width, canvas.height]);
      for (const [k, v] of Object.entries(values)) set(p.uniforms[k], v);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

export { COMMON };
