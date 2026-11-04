# TRACE hero experience

The question mark represents an uncertain report becoming a useful lead and, finally, a human-reviewed return. It opens at a 45-degree angle and completes one continuous turn. The composition uses the four-color TRACE palette, editorial type, one restrained 3D subject, a subtle circular search field behind the mark, and a continuous camera move. A light matching tint and dark final call to action create contrast while the main sections remain pale. The content remains readable without WebGL.

## Storyboard

| Story progress (before the end hold) | Visual and message |
| --- | --- |
| 0–0.15 | Question mark opens at 45 degrees beside the headline and two primary actions. |
| 0.15–0.35 | Mark rotates; the camera moves closer and the orbit ring appears. |
| 0.32–0.54 | All intro copy, including action labels, dissolves across the text while fragments sampled from its glyphs drift away. Side perspective and changing light reveal depth. |
| 0.52–0.76 | “Possible matches, ranked” assembles by 0.66 and holds for reading while the camera widens. |
| 0.76–0.96 | Matching copy dissolves by 0.86; the human-review copy assembles from 0.85 with the same reversible treatment. |
| 0.96–1 | The final claim-review message remains beside the fully turned mark until the hero gives way to the next section. |

## Implementation

This is a React/Vite application. The hero uses Three.js, React Three Fiber, Drei, and the existing Framer Motion scroll value. `sampleHeroFrame` maps any normalized progress to camera, mark, orbit, and light state. The same progress produces the same target frame when scrolling forward, backward, or jumping. Three.js refs apply the sampled state without React renders per frame. Damping smooths the displayed frame and demand rendering stops once it settles.

The desktop section uses a 760vh container with CSS sticky positioning: 540vh of story travel followed by a 120vh hold on the final composition. The intro stays intact through 32% of text progress before dissolving. Text has a demand-driven catch-up controller: transitions advance at most 0.14 normalized progress per second, so fast scroll input still traverses the ash effect. The mark responds to scroll with the scene's existing damping, completes its turn by 88% of story progress, and remains fully opaque and centered inside its original circle. Pointer offsets settle to zero in the final pose. Wider camera framing preserves the complete silhouette; a CSS radial shadow replaces the clipped contact-shadow plane and avoids that render pass. The 3D module loads separately from the main page. Reduced-motion, unavailable WebGL, load errors, and context loss use the SVG mark. Mobile uses the simpler layout and a bounded device pixel ratio.

`AshLayer` samples rendered glyph positions on the first transition after a layout change and reuses the result on later forward/reverse passes. A glyph cache avoids repeated pixel reads for identical characters, and each chapter is bounded to 2,200 particles. Larger ink/slate fragments follow the same scroll progress as the text mask. Particle drawing stops during reading holds and outside transitions; the text stays semantic HTML beneath the effect. Reduced-motion and mobile layouts do not create the particle canvases.

The mark is generated from the brand question-mark path as welded tube geometry plus a dot sphere. No external model or texture is needed. If this subject changes to a realistic object later, use an optimized GLB with normalized pivot, compressed textures, bounded polygon count, and measured download/render cost before replacing the procedural asset. A pre-rendered frame sequence would improve fixed photorealistic imagery but would lose responsive lighting and camera interaction; real-time geometry fits this abstract brand mark.

GSAP ScrollTrigger was considered for high-level progress. The existing Framer Motion scroll value already owns that progress and feeds a deterministic pure timeline; adding a second scroll controller would duplicate ownership without improving this scene. React/Vite remains the application foundation.

## Validation and limits

Run `npm ci`, `npm run build`, `npm run test:hero-timeline`, and `npm run test:consistency` from the repository root. The existing browser suite requires installed Chrome and a running preview server. Inspect desktop, mobile, reduced-motion, and WebGL fallback paths in a browser after visual changes. The lazy HeroScene bundle is approximately 895 kB minified; profile real devices before claiming a frame-rate target. No external 3D asset pipeline is needed for the current procedural mark.
