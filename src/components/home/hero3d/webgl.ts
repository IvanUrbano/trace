let cached: boolean | null = null

export function isWebGLAvailable(): boolean {
  if (cached !== null) return cached
  try {
    const probe = document.createElement('canvas')
    const gl =
      (probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) as WebGL2RenderingContext | null) ??
      (probe.getContext('webgl', { failIfMajorPerformanceCaveat: false }) as WebGLRenderingContext | null)
    cached = gl !== null
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
