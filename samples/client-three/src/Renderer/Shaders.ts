export const VertexShader = `
	varying vec2 v_UV;
	varying vec2 v_UV2;
	
#ifdef _HAS_LIGHTMAP
	in vec2 uv2;	
#endif
	
	void main()
	{
		v_UV = uv;
		
#ifdef _HAS_LIGHTMAP
		v_UV2 = uv2;
#endif
		
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

export const FragmentShader = `
	uniform sampler2D g_TexDiffuse;
	uniform sampler2D g_TexRenderTarget;
	uniform sampler2D g_TexLightMap;
	
	uniform float opacity;
	
	varying vec2 v_UV;
	varying vec2 v_UV2;
	
	void main()
	{
	#ifdef _FULLSCENERENDERTARGET
		vec4 DiffuseMapColor = texture2D(g_TexRenderTarget, vec2(v_UV.x, 1.0 - v_UV.y));
	#else
		vec4 DiffuseMapColor = texture2D(g_TexDiffuse, v_UV);
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
	
		gl_FragColor = Final * vec4(1, 1, 1, opacity);
	
	#ifdef _ALPHA_TEST
		if (gl_FragColor.a - 0.80f < 0.0f)
			discard;
	#endif
	}
`;