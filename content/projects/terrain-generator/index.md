---
title: Procedural Terrain Generator
date: 2026-07-30
description: An interactive OpenGL terrain viewer with deterministic procedural generation, geographic heightmaps, live hydraulic erosion, mesh sampling, and terrain material blending.
tags: [c++, opengl, procedural-generation, hydraulic-erosion, imgui]
cover: /assets/projects/terrain-generator/diamond-square.png
---

# Procedural Terrain Generator

This project is an interactive terrain viewer built with C++ and OpenGL. It can generate repeatable landscapes from diamond-square or multi-octave fractal noise, load real geographic heightmaps, and simulate hydraulic erosion either as a one-time pass or continuously while the terrain is running.

## Procedural generation

The two procedural generators are deterministic: the same seed and settings reproduce the same height field. Diamond-square exposes terrain roughness, while fractal noise includes controls for frequency, octaves, lacunarity, persistence, domain warping, and ridge blending.

{% grid %}

![Terrain generated with the diamond-square algorithm](/assets/projects/terrain-generator/diamond-square.png)

![Terrain generated with multi-octave fractal noise](/assets/projects/terrain-generator/fractal-noise.png)

{% endgrid %}

## Geographic heightmaps

Image heightmaps are normalized, kept in their original orientation, and resampled to a common maximum footprint while preserving geographic aspect ratio. The viewer includes heightmaps for Australia, the contiguous United States, and Mars, with independent controls for map scale and vertical relief.

![Contiguous United States heightmap rendered with terrain materials](/assets/projects/terrain-generator/USA.png)

## Live hydraulic erosion

Procedural terrain can be eroded with a droplet-based hydraulic simulation. The system supports both a fixed one-shot pass and a live mode that evolves the landscape over time. Controls cover the droplet rate, time scale, lifetime, erosion radius, inertia, sediment capacity, deposition, evaporation, gravity, and surface relaxation.

{% grid %}

![Live hydraulic erosion reshaping procedural terrain](/assets/projects/terrain-generator/erosion-1.webp)

![Hydraulic erosion forming a water-filled valley](/assets/projects/terrain-generator/erosion-2.webp)

{% endgrid %}

## Version 1.0

This is the project in version 1.0, as a proof of concept of the algorithms and visualizer.

{% video youtube:jXcNmnmen_8 %}

[View the source and latest media on GitHub](https://github.com/LepronlineR/Terrain-Generator-OpenGL)
