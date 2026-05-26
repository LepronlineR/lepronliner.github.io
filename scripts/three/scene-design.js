export const CAMERA_DESIGN = {
  target: [0.05, 0.02, -0.55],
  start: [0.1, 2.75, 8.0],
  distance: {
    initial: 8,
    min: 5.4,
    max: 11.2
  },
  pitch: {
    min: -0.28,
    max: 0.34
  }
};

export const WORLD_DESIGN = {
  position: [0.05, -0.72, -0.6],
  island: {
    radiusX: 3.95,
    radiusZ: 2.65,
    rings: 12,
    segments: 40,
    rotationY: -0.08
  },
  ocean: {
    radius: 54,
    rings: 88,
    segments: 192,
    y: -0.12,
    shaders: {
      vertex: "/scripts/three/shaders/ocean.vert.glsl",
      fragment: "/scripts/three/shaders/ocean.frag.glsl"
    }
  }
};

export const SCENE_COLORS = {
  lighting: {
    ambient: "hsl(35, 27%, 62%)",
    key: "hsl(38, 36%, 74%)"
  },
  models: {
    palmTint: "hsl(67, 8%, 53%)",
    zxTint: "hsl(48, 8%, 62%)",
    c64Tint: "hsl(43, 8%, 58%)",
    petTint: "hsl(42, 12%, 61%)"
  },
  island: {
    textureBase: "hsl(42, 15%, 33%)",
    texturePatch: {
      hue: [48, 58],
      saturation: 15,
      lightness: [22, 38],
      alpha: 0.38
    },
    sand: "hsl(43, 19%, 45%)",
    grass: "hsl(76, 11%, 35%)",
    rock: "hsl(42, 12%, 58%)",
    waterline: "hsl(44, 22%, 31%)",
    cliff: "hsl(25, 25%, 9%)"
  },
  ocean: {
    baseNear: "hsl(200, 100%, 17%)",
    baseFar: "hsl(190, 100%, 25%)",
    ribbon: "hsl(195, 86%, 38%)",
    ribbonCore: "hsl(190, 59%, 63%)",
    shadowRibbon: "hsl(199, 100%, 11%)",
    horizonMix: [0.05, 0.25, 0.32]
  },
  haze: {
    top: "rgba(20, 54, 66, 0)",
    center: "rgba(22, 84, 96, 0.18)",
    lower: "rgba(2, 16, 22, 0.34)",
    bottom: "rgba(0, 0, 0, 0)"
  },
  stars: {
    hue: [0.58, 0.68],
    saturation: 0.28,
    lightness: [0.78, 0.98]
  }
};

export const ISLAND_LINKS = [
  {
    key: "about",
    label: "Zhi Zheng",
    surface: [0, -0.08, 0.58],
    marker: {
      model: "pet",
      surface: [0, -0.08, -0.03],
      scale: 0.88,
      yScale: 0.72,
      rotation: -0.12
    },
    card: {
      kicker: "About",
      title: "Zhi Zheng",
      text: "Software engineer building tools, game systems, and interactive workflows.",
      href: "/#about-title"
    }
  },
  {
    key: "projects",
    label: "Projects",
    surface: [-1.8, 0.56, 0.74],
    marker: {
      model: "palm",
      surface: [-1.8, 0.56, 0],
      scale: 1.72,
      rotation: -0.82
    },
    card: {
      kicker: "Projects",
      title: "Projects",
      text: "Markdown-backed project notes and implementation writeups.",
      href: "/projects/"
    }
  },
  {
    key: "blog",
    label: "Blog",
    surface: [0.08, 1.22, 0.38],
    marker: {
      model: "c64",
      surface: [0.08, 1.22, 0],
      scale: 0.9,
      rotation: 0.06
    },
    card: {
      kicker: "Blog",
      title: "Blog",
      text: "Technical notes with code, math, tags, and generated pages.",
      href: "/blog/"
    }
  },
  {
    key: "home",
    label: "Home",
    surface: [1.72, 0.48, 0.68],
    marker: {
      model: "palm",
      surface: [1.72, 0.48, 0],
      scale: 1.62,
      rotation: 0.54
    },
    card: {
      kicker: "Home",
      title: "Home",
      text: "The regular portfolio page with experience, education, projects, and contact links.",
      href: "/"
    }
  }
];

export const DECORATIVE_MARKERS = [
  {
    model: "palm",
    surface: [-0.88, -0.72, 0],
    scale: 1.34,
    rotation: -1.35
  },
  {
    model: "palm",
    surface: [0.92, -0.68, 0],
    scale: 1.28,
    rotation: 1.2
  },
  {
    model: "palm",
    surface: [0.62, 0.28, 0],
    scale: 1.18,
    rotation: 2.2
  }
];
