precision highp float;

varying vec2 v_UV;
#ifdef _HAS_LIGHTMAP
varying vec2 v_UV2;
#endif

uniform float g_Opacity;

uniform sampler2D g_TexDiffuseMap;
uniform sampler2D g_TexLightMap;

void main(void)
{
	#ifdef _FULLSCENERENDERTARGET
		vec4 DiffuseMapColor = texture2D(g_TexRenderTarget, v_UV);
	#else
		vec4 DiffuseMapColor = texture2D(g_TexDiffuseMap, v_UV);
	#endif

	#ifdef _HAS_LIGHTMAP
        vec4 LightMapColor = texture2D(g_TexLightMap, v_UV2);
        vec4 Final = DiffuseMapColor * (LightMapColor * vec4(2, 2, 2, 2));
        Final.a = DiffuseMapColor.a;
    #else
        vec4 Final = DiffuseMapColor;
    #endif

	#ifdef _RENDERTYPE_OPAQUE
		Final.a = 1.0;
	#endif

	gl_FragColor = Final * vec4(1, 1, 1, 1);

	//#ifdef _ALPHA_TEST
	//	if (gl_FragColor.a - 0.80f < 0.0f)
	//		discard;
	//#endif
}