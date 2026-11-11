// All the tunable art direction and content for the island lives here.

export const CAMERA_DESIGN = {
  target: [0.05, 0.02, -0.55],
  fov: 36,
  distance: {
    initial: 8,
    focus: 6.3,
    intro: 12.5,
    min: 5.2,
    max: 11.5
  },
  pitch: {
    initial: 0.04,
    min: -0.28,
    max: 0.34
  },
  // Slow idle spin (radians per second) once nobody has touched the scene for a while.
  idle: {
    speed: 0.045,
    delay: 5
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
    rings: 72,
    segments: 144,
    y: -0.12
  }
};

export const SCENE_COLORS = {
  models: {
    palmTint: "hsl(67, 8%, 53%)",
    zxTint: "hsl(48, 8%, 62%)",
    c64Tint: "hsl(43, 8%, 58%)",
    petTint: "hsl(42, 12%, 61%)",
    wood: "hsl(28, 30%, 34%)",
    woodLight: "hsl(34, 34%, 48%)"
  },
  island: {
    textureBase: "hsl(42, 18%, 50%)",
    texturePatch: {
      hue: [48, 58],
      saturation: 15,
      lightness: [38, 60],
      alpha: 0.38
    },
    sand: "hsl(42, 32%, 60%)",
    grass: "hsl(84, 24%, 42%)",
    rock: "hsl(42, 12%, 58%)",
    waterline: "hsl(44, 30%, 48%)",
    cliff: "hsl(25, 25%, 9%)"
  },
  stars: {
    hue: [0.58, 0.68],
    saturation: 0.28,
    lightness: [0.78, 0.98]
  }
};

// Each landmark: where it sits (x, z on the island), what marks it, and what it leads to.
// `labelLift` is how far above the ground the floating label sits.
export const ISLAND_LINKS = [
  {
    key: "about",
    label: "About",
    position: [0, -0.5],
    labelLift: 1.0,
    hitRadius: 0.55,
    marker: { model: "pet", scale: 0.88, yScale: 0.72, rotation: -0.12 },
    card: {
      kicker: "About",
      title: "Zhi Zheng",
      text: "Software Engineer at 2K Games.",
      href: "/#experience",
      cta: "Experience",
      items: [
        { title: "Experience", url: "/#experience" },
        { title: "Education", url: "/#education" },
        { title: "Get in touch", url: "/#contact" }
      ]
    }
  },
  {
    key: "projects",
    label: "Projects",
    position: [-1.7, 0.5],
    labelLift: 0.62,
    hitRadius: 0.5,
    marker: { model: "zx", scale: 0.86, rotation: 0.5 },
    card: {
      kicker: "Projects",
      title: "Projects",
      text: "Project write-ups and implementation notes.",
      href: "/projects/",
      cta: "All projects",
      itemsFrom: "/projects/projects.json"
    }
  },
  {
    key: "blog",
    label: "Blog",
    position: [1.65, 0.55],
    labelLift: 0.58,
    hitRadius: 0.5,
    marker: { model: "c64", scale: 0.9, rotation: -0.45 },
    card: {
      kicker: "Blog",
      title: "Blog",
      text: "Math, machine learning, graphics, game systems, and problem solving.",
      href: "/blog/",
      cta: "All posts",
      itemsFrom: "/blog/posts.json"
    }
  },
  {
    key: "resume",
    label: "Résumé",
    position: [-0.62, 1.5],
    labelLift: 0.78,
    hitRadius: 0.45,
    marker: { model: "signpost", scale: 0.72, rotation: 0.25 },
    card: {
      kicker: "Résumé",
      title: "R\u00e9sum\u00e9",
      text: "Experience and education on one page.",
      href: "/resume/",
      cta: "Open r\u00e9sum\u00e9"
    }
  }
];

export const DECORATIVE_MARKERS = [
  { model: "palm", position: [-2.45, -0.35], scale: 1.72, rotation: -0.82 },
  { model: "palm", position: [2.4, -0.4], scale: 1.62, rotation: 0.54 },
  { model: "palm", position: [-0.95, -1.15], scale: 1.34, rotation: -1.35 },
  { model: "palm", position: [1.05, -1.1], scale: 1.28, rotation: 1.2 },
  { model: "palm", position: [-2.75, 0.75], scale: 1.05, rotation: 2.2 }
];

// Everything that changes between the night scene (dark theme) and the day scene (light theme).
export const SCENE_THEMES = {
  dark: {
    stars: true,
    lighting: {
      ambient: "hsl(35, 27%, 62%)",
      ambientIntensity: 2.15,
      key: "hsl(38, 36%, 74%)",
      keyIntensity: 0.88,
      glow: "hsl(24, 95%, 62%)",
      glowIntensity: 5
    },
    tints: {
      island: "hsl(0, 0%, 100%)",
      palm: SCENE_COLORS.models.palmTint,
      zx: SCENE_COLORS.models.zxTint,
      c64: SCENE_COLORS.models.c64Tint,
      pet: SCENE_COLORS.models.petTint,
      wood: SCENE_COLORS.models.wood,
      woodLight: SCENE_COLORS.models.woodLight
    },
    ocean: {
      baseNear: "hsl(200, 100%, 17%)",
      baseFar: "hsl(190, 100%, 25%)",
      ribbon: "hsl(195, 86%, 38%)",
      ribbonCore: "hsl(190, 59%, 63%)",
      shadowRibbon: "hsl(199, 100%, 11%)",
      foam: "hsl(188, 60%, 78%)",
      horizonMix: [0.05, 0.25, 0.32]
    },
    haze: {
      top: "rgba(20, 54, 66, 0)",
      center: "rgba(22, 84, 96, 0.18)",
      lower: "rgba(2, 16, 22, 0.34)",
      bottom: "rgba(0, 0, 0, 0)"
    }
  },
  light: {
    stars: false,
    lighting: {
      ambient: "hsl(44, 45%, 92%)",
      ambientIntensity: 2.9,
      key: "hsl(42, 85%, 90%)",
      keyIntensity: 2.3,
      glow: "hsl(24, 95%, 62%)",
      glowIntensity: 0
    },
    tints: {
      island: "hsl(44, 40%, 96%)",
      palm: "hsl(88, 26%, 82%)",
      zx: "hsl(45, 8%, 90%)",
      c64: "hsl(40, 10%, 88%)",
      pet: "hsl(40, 12%, 90%)",
      wood: "hsl(28, 36%, 40%)",
      woodLight: "hsl(34, 42%, 60%)"
    },
    ocean: {
      baseNear: "hsl(191, 72%, 40%)",
      baseFar: "hsl(196, 62%, 60%)",
      ribbon: "hsl(187, 62%, 60%)",
      ribbonCore: "hsl(180, 65%, 90%)",
      shadowRibbon: "hsl(198, 78%, 30%)",
      foam: "hsl(180, 60%, 96%)",
      horizonMix: [0.8, 0.91, 0.95]
    },
    haze: {
      top: "rgba(255, 255, 255, 0)",
      center: "rgba(236, 246, 248, 0.55)",
      lower: "rgba(214, 236, 242, 0.4)",
      bottom: "rgba(255, 255, 255, 0)"
    }
  }
};
