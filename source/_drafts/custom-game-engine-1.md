---
title: Developing a Custom Game Engine pt. 1
tags: [C++, game development, game engine]
categories: [Game Development]
date: 2024-07-23 01:00:20
description: This is a series where we implement a custom game engine from scratch
topic: custom_game_engine
type: tech
---

# Introduction

Many game engines nowadays have multi-function purposes, and generally if you're good enough there's not much demand to develop upcoming game engines. The big three still stand out for game development: Unity, Unreal and Godot, all of which have their specific advantages that others don't. However, there are some cases for specific games that want to implement a mechanic that is better off creating a new engine overall. For instance, Noita, a roguelike with a unique mechanic where every pixel is simulated.

## The idea

If you have ever played a first person horror game, it usually relies on jumpscares or "event" triggers to get you. Moreover, many horror games now fall into various horror game tropes like the "jumpscare" to easily scare a person or the classic slenderman approach of "finding notes" by walking around a general zone. I want to look into reinventing many different horror tropes, and working on how I can create fear. 

