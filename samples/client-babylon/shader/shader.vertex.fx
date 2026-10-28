precision highp float;

// Attributes
attribute vec3 position;
attribute vec2 uv;

#ifdef _HAS_LIGHTMAP
attribute vec2 uv2;
#endif

// Uniforms
uniform mat4 worldViewProjection;

// Varying
varying vec2 v_UV;
varying vec2 v_UV2;

void main(void) {
    gl_Position = worldViewProjection * vec4(position, 1.0);

    v_UV = uv;
    #ifdef _HAS_LIGHTMAP
    v_UV2 = uv2;
    #endif
}