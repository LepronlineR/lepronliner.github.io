const shaderCache = new Map();

export async function loadShader(path) {
  if (!shaderCache.has(path)) {
    shaderCache.set(path, fetch(path).then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load shader: ${path}`);
      }
      return response.text();
    }));
  }

  return shaderCache.get(path);
}

export async function loadShaderPair({ vertex, fragment }) {
  const [vertexShader, fragmentShader] = await Promise.all([
    loadShader(vertex),
    loadShader(fragment)
  ]);

  return { vertexShader, fragmentShader };
}
