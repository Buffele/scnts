export enum NsRenderFlags
{
	None = 0,
	LightDisable = 1 << 0,
	AlphaBlend1 = 1 << 1,
	AlphaTest = 1 << 2,
	NoCull = 1 << 3,
	Billboard = 1 << 4,
	AlphaBlend2 = 1 << 5,
	NoDepthWrite = 1 << 6,
	Decal = 1 << 7,
	NoPreRender = 1 << 8,
	FogDisable = 1 << 9,
	NoDepthTest = 1 << 10,
	NoMipMap = 1 << 11,
	VertexAnim = 1 << 12,
	ShadowSurface = 1 << 13,
	Glow = 1 << 14,
	Haze = 1 << 15,
	Refract = 1 << 16,
	AlphaBlend3 = 1 << 17
}