# 3D Onboarding Animation Design Spec

## Overview
A 3D interactive animation for the GitHub Pages documentation of the `openshift-integration-operator`. It serves as an onboarding tool, visually explaining the architecture and flow between different integration middlewares on OpenShift 4.20.

## Architecture & Technology
*   **Engine:** Three.js (pure JavaScript/WebGL) for maximum performance and minimum bundle size on GitHub Pages.
*   **UI Overlay:** Standard HTML/CSS positioned absolutely over the `<canvas>` for text panels, buttons, and code snippets.
*   **Animations:** GSAP (GreenSock) or Tween.js for smooth camera transitions and UI fade-ins.

## Visual Design (The Scene)
*   **Environment:** Dark, tech-focused "cyberspace" aesthetic.
*   **Nodes (Middlewares):**
    *   Represented as floating pedestals.
    *   On top of each pedestal, a translucent glass cube.
    *   Inside the cube, the official logo of the technology (rendered as a texture on a plane or a 3D object if SVG is parsed).
    *   *Nodes included:* OpenShift (Base), Apache Camel, SonataFlow (Kogito), Apache Kafka (AMQ Streams).
*   **Connections:** Glowing lines connecting the nodes.
*   **Data Flow:** Particle system (small glowing spheres) traveling along the connection lines to simulate message/event flow.

## Interaction Design (UX)
*   **Default State:** The scene auto-rotates slowly. Particles flow continuously.
*   **Controls:** `OrbitControls` enabled. User can click-drag to rotate, scroll to zoom.
*   **Hover State:** Raycasting detects mouse over a node. The node glows brighter, auto-rotation pauses, cursor changes to pointer.
*   **Click State (Focus):**
    1.  Camera animates smoothly to focus on the clicked node.
    2.  An HTML/CSS panel (glassmorphism style) slides in from the side.
*   **Info Panel Content:**
    *   Title (e.g., "Apache Camel").
    *   Short description of its role in the operator.
    *   A small YAML snippet showing a CRD example.
    *   "Back to Overview" button to reset camera and close panel.
*   **Full Screen:** A dedicated button in the UI overlay to request Fullscreen API for the container.

## Assets Required
*   Official Logos (SVG or high-res PNG with transparency):
    *   OpenShift
    *   Apache Camel
    *   SonataFlow / Kogito
    *   Apache Kafka

## Deployment
*   The solution will be built as static HTML/JS/CSS files.
*   It will be integrated into the existing `docs/` folder structure to be served seamlessly by GitHub Pages.