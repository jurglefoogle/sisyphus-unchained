import { BlurFilter, Filter, GlProgram, Texture, TexturePool, UniformGroup, type FilterSystem, type RenderSurface } from 'pixi.js';

/**
 * The kiln: a full-screen post pipeline over the painted scene.
 *
 *   1. Distort — shockwaves ringing out from heavy blows, heat haze over the
 *      Tartarus pit, and the sea rippling and glittering where it shows.
 *   2. Light — a bright pass (bloom) and volumetric light scattered from the
 *      hill's sun, so hills, temples and trees cut shafts out of it; blurred.
 *   3. Finish — bloom and light laid over the scene, a split-tone grade per
 *      hill, a flash for the hit frame, the glaze (grain, crazing, sheen) and
 *      a darkened rim, like the foot of a pot.
 *
 * All of it is cosmetic and off with the Rich effects option.
 */

const VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vFrame;
out vec2 vTexScale;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTexScale = uOutputFrame.zw * uInputSize.zw;
    vTextureCoord = aPosition * vTexScale;
    // 0..1 across the filtered frame, whatever the texture's padding.
    vFrame = aPosition;
}
`;

const NOISE = /* glsl */ `
float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash2(vec2 p)
{
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float noise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float luma(vec3 c)
{
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
`;

// ---------------------------------------------------------------- distort

const DISTORT = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vFrame;
in vec2 vTexScale;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uScreen;
uniform vec2 uOrigin;
uniform float uZoom;
uniform float uTime;
uniform vec4 uWaves[4];
uniform vec4 uHaze;
uniform vec3 uSea;

${NOISE}

float seaMask(vec3 c)
{
    // The painted sea: blue-grey, cooler than anything else on a hill.
    return smoothstep(0.03, 0.12, c.b - c.r) * smoothstep(0.02, 0.08, c.g - c.r + 0.04);
}

void main(void)
{
    vec2 px = vFrame * uScreen;
    vec2 world = (px - uOrigin) / uZoom;
    vec2 off = vec2(0.0);
    float ring = 0.0;

    // Shockwaves: a ring that pushes the picture outward as it passes.
    for (int i = 0; i < 4; i++)
    {
        vec4 w = uWaves[i];
        if (w.w <= 0.0) continue;
        vec2 d = px - w.xy;
        float dist = length(d) + 0.0001;
        float band = (18.0 + w.z * 0.12) * uZoom;
        float x = (dist - w.z * uZoom) / band;
        float g = exp(-x * x * 2.2);
        off += (d / dist) * x * g * w.w * uZoom * 1.6;
        ring += g * w.w / 24.0;
    }

    // Heat haze rising over the pit: stronger toward the ground.
    if (uHaze.x > 0.0)
    {
        float k = smoothstep(uHaze.y, uHaze.z, px.y);
        float n1 = noise(world * vec2(0.018, 0.03) + vec2(0.0, uTime * 1.4));
        float n2 = noise(world * vec2(0.04, 0.07) - vec2(uTime * 0.5, uTime * 2.3));
        off += (vec2(n1, n2) - 0.5) * 2.0 * uHaze.x * uZoom * k;
    }

    vec4 base = texture(uTexture, vTextureCoord);
    vec3 baseRgb = base.a > 0.0 ? base.rgb / base.a : base.rgb;

    // The sea moves: long swells shift it sideways, a few pixels at most.
    float sea = 0.0;
    if (uSea.x > 0.0)
    {
        sea = seaMask(baseRgb) * smoothstep(uSea.y - 4.0, uSea.y + 12.0, px.y) * (1.0 - smoothstep(uSea.z - 20.0, uSea.z, px.y));
        float swell = sin(world.y * 0.55 + uTime * 1.3 + noise(world * vec2(0.012, 0.2)) * 5.0);
        off.x += swell * 1.6 * uZoom * sea * uSea.x;
    }

    vec2 uv = vTextureCoord + off / uScreen * vTexScale;
    vec4 c = texture(uTexture, uv);

    // Glitter on the swells: short bright strokes that come and go, the way
    // a vase painter would mark light on water.
    if (sea > 0.0)
    {
        vec2 cell = vec2(46.0, 7.0);
        vec2 id = floor(world / cell);
        vec2 f = fract(world / cell) - 0.5;
        float seed = hash(id);
        float on = step(0.72, seed) * pow(max(0.0, sin(uTime * (1.2 + seed * 2.0) + seed * 40.0)), 6.0);
        float stroke = (1.0 - smoothstep(0.1, 0.45, abs(f.x))) * (1.0 - smoothstep(0.08, 0.32, abs(f.y)));
        c.rgb += vec3(1.0, 0.95, 0.82) * on * stroke * sea * uSea.x * 1.1 * c.a;
    }

    // A pale lip where a shockwave's ring passes.
    c.rgb += vec3(1.0, 0.93, 0.8) * min(ring, 1.0) * 0.12 * c.a;
    finalColor = c;
}
`;

export class DistortFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: DISTORT, name: 'kiln-distort' }),
      resources: {
        distort: new UniformGroup({
          uScreen: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uOrigin: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uZoom: { value: 1, type: 'f32' },
          uTime: { value: 0, type: 'f32' },
          uWaves: { value: new Float32Array(16), type: 'vec4<f32>', size: 4 },
          uHaze: { value: new Float32Array(4), type: 'vec4<f32>' },
          uSea: { value: new Float32Array(3), type: 'vec3<f32>' },
        }),
      },
      resolution: 'inherit',
      antialias: 'inherit',
    });
  }

  get u() {
    return this.resources.distort.uniforms;
  }
}

// ------------------------------------------------------------------ light

const RAY_SAMPLES = 36;

const EXTRACT = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vFrame;
in vec2 vTexScale;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uScreen;
uniform vec2 uSun;
uniform float uThreshold;
uniform vec4 uRay;
uniform vec3 uLight;

${NOISE}

void main(void)
{
    vec4 c = texture(uTexture, vTextureCoord);
    vec3 col = c.a > 0.0 ? c.rgb / c.a : c.rgb;

    // Bloom: only what is truly bright — gold, sparks, glints, the sun.
    float l = luma(col);
    vec3 glow = col * smoothstep(uThreshold, uThreshold + 0.1, l);

    // Light scattered from the sun: march toward it, gathering bright sky;
    // anything dark in between (a hill, a column, a tree) casts a shaft.
    // uRay: strength, length (px), sky threshold, horizon (px).
    vec3 rays = vec3(0.0);
    if (uRay.x > 0.0)
    {
        vec2 px = vFrame * uScreen;
        vec2 toSun = uSun - px;
        float dist = length(toSun);
        vec2 stride = toSun * min(1.0, uRay.y / max(dist, 1.0)) / float(${RAY_SAMPLES});
        vec2 p = px + stride * hash(px);
        float decay = 1.0;
        float sum = 0.0;
        for (int i = 0; i < ${RAY_SAMPLES}; i++)
        {
            vec2 f = p / uScreen;
            if (f.x >= 0.0 && f.x <= 1.0 && f.y >= 0.0 && f.y <= 1.0)
            {
                vec4 s = texture(uTexture, f * vTexScale);
                float sky = 1.0 - smoothstep(uRay.w - 30.0, uRay.w + 20.0, p.y);
                sum += smoothstep(uRay.z, uRay.z + 0.12, luma(s.rgb)) * sky * decay;
            }
            decay *= 0.97;
            p += stride;
        }
        // Brighter near the sun, fading with distance from it.
        float near = 1.0 - smoothstep(0.0, uRay.y * 1.1, dist);
        rays = uLight * (sum / float(${RAY_SAMPLES})) * uRay.x * (0.35 + 0.65 * near);
    }
    finalColor = vec4(glow + rays, 1.0);
}
`;

const FINISH = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vFrame;
in vec2 vTexScale;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uLightTexture;
uniform vec2 uScreen;
uniform vec2 uOrigin;
uniform float uZoom;
uniform float uBloom;
uniform vec3 uTint;
uniform vec3 uShadow;
uniform vec3 uHigh;
uniform vec4 uFlash;
uniform float uVignette;
uniform float uGlaze;

${NOISE}

// Distance to the nearest cell border of a Voronoi field: glaze crazing.
float crazing(vec2 p)
{
    vec2 n = floor(p);
    vec2 f = fract(p);
    vec2 mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++)
    {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        float d = dot(r, r);
        if (d < md) { md = d; mr = r; }
    }
    md = 8.0;
    for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++)
    {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        if (dot(mr - r, mr - r) > 0.00001)
            md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
    }
    return md;
}

void main(void)
{
    vec4 c = texture(uTexture, vTextureCoord);
    vec3 col = c.a > 0.0 ? c.rgb / c.a : c.rgb;
    vec3 light = texture(uLightTexture, vTextureCoord).rgb;
    vec2 screen = vFrame * uScreen;
    vec2 world = (screen - uOrigin) / uZoom;

    // Split tone: cool, deep shadows and warm, lifted highlights per kiln.
    float l = luma(col);
    col *= mix(uShadow, uHigh, smoothstep(0.15, 0.85, l));
    col = mix(col, col * uTint, 0.5);
    // A gentle filmic shoulder so the brights roll off instead of clipping.
    col = col / (1.0 + max(vec3(0.0), col - 0.85) * 1.6);

    // Light and bloom, screened over the paint.
    col = 1.0 - (1.0 - col) * (1.0 - clamp(light * uBloom, 0.0, 1.0));

    // The glaze: fine grain in the slip, crazing in patches on the light areas.
    l = luma(col);
    float grain = hash(floor(screen * 0.8)) - 0.5;
    col += grain * 0.05 * uGlaze * (0.6 + 0.8 * l * (1.0 - l));
    const float CELL = 72.0;
    float edge = crazing(world / CELL);
    float line = 1.0 - smoothstep(0.0, 1.0 / (CELL * max(0.2, uZoom)), edge);
    float crazed = smoothstep(0.35, 0.75, noise(world / 420.0 + 7.0)) * smoothstep(0.45, 0.95, uZoom);
    col *= 1.0 - line * 0.05 * uGlaze * crazed * smoothstep(0.35, 0.7, l) * (1.0 - smoothstep(0.75, 0.95, l));
    float sheen = 1.0 - smoothstep(0.0, 0.85, distance(vFrame, vec2(0.28, 0.12)));
    col += sheen * sheen * 0.03 * uGlaze;

    // The hit frame: a warm flash that favours the lights.
    col = mix(col, uFlash.rgb, uFlash.a * (0.35 + 0.65 * l));

    // A darker rim, like the shadowed foot of a pot.
    vec2 q = (vFrame - 0.5) * vec2(1.0, 0.82);
    col *= 1.0 - uVignette * smoothstep(0.32, 0.78, length(q));

    finalColor = vec4(clamp(col, 0.0, 1.0) * c.a, c.a);
}
`;

export class KilnFilter extends Filter {
  readonly extract: Filter;
  private blur = new BlurFilter({ strength: 14, quality: 4, kernelSize: 7 });

  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: FINISH, name: 'kiln-finish' }),
      resources: {
        finish: new UniformGroup({
          uScreen: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uOrigin: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uZoom: { value: 1, type: 'f32' },
          uBloom: { value: 1, type: 'f32' },
          uTint: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
          uShadow: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
          uHigh: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
          uFlash: { value: new Float32Array([1, 1, 1, 0]), type: 'vec4<f32>' },
          uVignette: { value: 0.3, type: 'f32' },
          uGlaze: { value: 0.5, type: 'f32' },
        }),
        uLightTexture: Texture.WHITE.source,
      },
      resolution: 'inherit',
      antialias: 'inherit',
    });
    this.extract = new Filter({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: EXTRACT, name: 'kiln-light' }),
      resources: {
        light: new UniformGroup({
          uScreen: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uSun: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
          uThreshold: { value: 0.9, type: 'f32' },
          uRay: { value: new Float32Array([0, 600, 0.8, 300]), type: 'vec4<f32>' },
          uLight: { value: new Float32Array([1, 0.9, 0.7]), type: 'vec3<f32>' },
        }),
      },
      resolution: 'inherit',
      antialias: 'inherit',
    });
    this.blur.repeatEdgePixels = true;
  }

  get u() {
    return this.resources.finish.uniforms;
  }

  /** A cheaper bloom: fewer blur passes. */
  set lite(on: boolean) {
    this.blur.quality = on ? 2 : 4;
  }

  get lightU() {
    return this.extract.resources.light.uniforms;
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const bright = TexturePool.getSameSizeTexture(input);
    filterManager.applyFilter(this.extract, input, bright, true);
    const soft = TexturePool.getSameSizeTexture(input);
    this.blur.apply(filterManager, bright, soft, true);
    this.resources.uLightTexture = soft.source;
    filterManager.applyFilter(this, input, output, clearMode);
    TexturePool.returnTexture(bright);
    TexturePool.returnTexture(soft);
  }
}

// -------------------------------------------------------------------- rim

const RIM = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec2 uDir;
uniform float uWidth;
uniform vec3 uColor;
uniform float uStrength;

float luma(vec3 c)
{
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main(void)
{
    vec4 c = texture(uTexture, vTextureCoord);
    if (c.a < 0.004) { finalColor = c; return; }
    vec2 d = uDir * uWidth * uInputSize.zw;
    // Toward the light: how much of the figure is missing just beyond this pixel.
    float lit = 1.0 - (texture(uTexture, vTextureCoord + d).a * 0.6 + texture(uTexture, vTextureCoord + d * 0.45).a * 0.4);
    // Away from it: the turned side falls into a slight shade.
    float away = 1.0 - (texture(uTexture, vTextureCoord - d * 1.6).a * 0.6 + texture(uTexture, vTextureCoord - d * 0.7).a * 0.4);
    vec3 col = c.rgb / c.a;
    float l = luma(col);
    // The light lies over clay and slip, and barely over black glaze.
    vec3 rim = uColor * clamp(lit, 0.0, 1.0) * uStrength * (0.45 + 0.55 * smoothstep(0.05, 0.4, l));
    col = 1.0 - (1.0 - col) * (1.0 - clamp(rim, 0.0, 1.0));
    col *= 1.0 - clamp(away, 0.0, 1.0) * 0.22 * uStrength;
    finalColor = vec4(col * c.a, c.a);
}
`;

/** Lights the edges of a figure that face the hill's light; shades the others. */
export class RimFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: RIM, name: 'kiln-rim' }),
      resources: {
        rim: new UniformGroup({
          uDir: { value: new Float32Array([-0.7, -0.7]), type: 'vec2<f32>' },
          uWidth: { value: 3, type: 'f32' },
          uColor: { value: new Float32Array([1, 0.9, 0.7]), type: 'vec3<f32>' },
          uStrength: { value: 0.8, type: 'f32' },
        }),
      },
      resolution: 'inherit',
      antialias: 'inherit',
      padding: 8,
    });
  }

  get u() {
    return this.resources.rim.uniforms;
  }
}
