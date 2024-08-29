---
title: Swapping Knights
tags: [math, computer science, problem solving, python, chess, graph theory]
categories: [Chess]
poster:
  topic: null
  headline: null
  caption: null
  color: null
date: 2024-08-22 18:58:18
description: Solve interesting chess problems with graph theory
cover: /assets/posts/swapping-knights/knights.png
---

# Swapping Knights

You have a chess configuration as:

{% image /assets/posts/swapping-knights/knights_one.png %}

How can you move the knights in any order so that it can look like:

{% image /assets/posts/swapping-knights/knights_two.png %}

That is:

{% image /assets/posts/swapping-knights/knights.png %}

# Visualization & Solution

Imagine that you have a knight on A1, and you need to map out the possible movements for this knight. At the start it can only move to either B3 or C2. Let's just take the path B3. Then we take C1, A2, C3, B1, A3, C2, A1. As you can see, our knight took an entire tour around this board and returned to the original position. This must mean that if we start the knight on any tile that is not B2, you can always reach some other point. Furthermore, if you are perceptive enough, you can tell that for a path of a single knight, we visited every position except for B2 once.

{% grid %} 
<!-- cell --> 
{% image width:100px /assets/posts/swapping-knights/single.png %}
<!-- cell --> 
{% image width:100px /assets/posts/swapping-knights/possible_moves.png %}
{% endgrid %}

Then, imagine our board as a graph, with each position on the board as a vertex.

{% image /assets/posts/swapping-knights/knights_graph.png %}

Using the last piece of information we gained, if the look at the board with a perspective of a graph, we can ascertain that the graph is representative of a cycle, and the path of the knight is an eulerian cycle.

Let's take the first configuration and add the other knights in their respective positions on the board and expand the board into a graph. We have:

{% image /assets/posts/swapping-knights/knights_cycle.png This graph is undirected. Ignore the arrows. %}

From this graph, the white knight at A3 can go from A3 to C2 as well as A3 to B1. However, the white knight cannot move from C2 to A1 since the black knight is blocking the path.

Now here is the second configuration we want to achieve with the knights in their respective positions on the board:

{% image /assets/posts/swapping-knights/knights_cycle_impossible.png This graph is undirected. Ignore the arrows. %}

As you can see, this configuration requires the neighboring knights to be of different color. However, achieving this configuration from the first configuration is impossible since one of the knights will have to swap places with another knight.

## Solution

Therefore, we cannot move the knights in any way to achieve our configuration.