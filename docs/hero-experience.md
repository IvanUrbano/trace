# TRACE hero experience

The question mark represents an uncertain report becoming a useful lead and, finally, a human-reviewed return. It opens at a 45-degree angle and completes one continuous turn. The composition uses the four-color TRACE palette, editorial type, one restrained 3D subject, a subtle circular search field behind the mark, and a continuous camera move. A light matching tint and dark final call to action create contrast while the main sections remain pale. The content remains readable without WebGL.

## Storyboard

| Story progress (before the end hold) | Visual and message |
| --- | --- |
| 0–0.15 | Question mark opens at 45 degrees beside the headline and two primary actions. |
| 0.15–0.35 | Mark rotates; the camera moves closer and the orbit ring appears. |
| 0.25–0.525 | Intro copy dissolves while fragments sampled from its glyphs drift away. |
| 0.51–0.755 | “Possible matches, ranked” assembles by 0.685 and holds for reading. |
| 0.755–1 | Matching copy dissolves by 0.88; human-review copy assembles from 0.8625 to the end of the story. |
| Final hold | The final claim-review message remains beside the fully turned mark until the hero gives way to the next section. |

The two later text chapters remain open on the hero background. Each has a small outline icon, a short hairline, and a discreet chapter number. Matching has three small ranking strokes beneath its copy; review has a compact review-to-handoff line. Card backgrounds, enclosing borders, shadows, and large decorative artwork were removed at the user's request. The accents add no image downloads or idle animation loop and follow the existing ash transition.

A thin gradient divider sits directly below the floating navigation, and a slow violet light sweeps across the glass panel on a 6-second cycle (static under reduced motion). The final CTA watermark is centered slightly left (46%); a static wrapper owns its translation while the inner Framer Motion span owns scale/opacity. Keeping those transforms separate prevents Framer Motion from overwriting Tailwind's centering and clipping the E. The watermark remains hidden on small screens.

## Implementation

`SurroundingDetails` adds static search rings, dotted paths with item tags, cross marks, and vertical Search/Connect/Return labels at the edges of the hero, process, and matching sections. It uses existing palette colors and inline SVG, remains hidden from assistive technology and pointer events, and reduces to faint cropped rings on mobile. Section clipping contains the artwork without changing hero scroll geometry. No new animation loops or image downloads are introduced.

This is a React/Vite application. The hero uses Three.js, React Three Fiber, Drei, and the existing Framer Motion scroll value. `sampleHeroFrame` maps any normalized progress to camera, mark, orbit, and light state. The same progress produces the same target frame when scrolling forward, backward, or jumping. Three.js refs apply the sampled state without React renders per frame. Damping smooths the displayed frame and demand rendering stops once it settles.

The desktop section uses an 895vh container with CSS sticky positioning: 675vh of story travel followed by a 120vh hold on the final composition. The 25% longer story distance reduces scroll sensitivity while the mark, fades, and particles follow the same direct progress. Each text fade also spans 25% more story progress than before, with adjusted chapter positions and a reading hold. Fast scroll jumps can skip intermediate particle frames. The mark retains scene damping, completes its turn by 88% of story progress, and remains fully opaque and centered inside its original circle. Pointer offsets settle to zero in the final pose. Wider camera framing preserves the complete silhouette; a CSS radial shadow replaces the clipped contact-shadow plane. Reduced-motion/mobile and WebGL fallback paths remain available.

The desktop WebGL mark has a 16px CSS bounce on a 3.2-second cycle that runs whenever scrolling has settled anywhere in the hero — including the top and the final hold — and pauses as soon as scroll moves (300ms settle delay). It is disabled for reduced motion. The animation moves a wrapper through CSS compositing rather than forcing continuous Three.js renders, so the whole canvas bobs together with the dashed orbit ring; keeping the ring still would require rendering the scene while at rest, which was tried and reverted as not optimized. Mobile and SVG fallback remain static. The final hold stays 120vh.

`AshLayer` prepares rendered glyph samples during browser idle time after layout/font changes and reuses them on forward/reverse passes. Text masks update immediately even while sampling is pending. Samples are distributed across the copy and capped at 1,200 particles per chapter, with canvas DPR capped at 1.5. Root width is cached outside the particle loop to avoid repeated layout reads. Particle drawing stops during reading holds; mobile and reduced-motion layouts do not create particle canvases. Real-device FPS is not yet measured.

The mask and particles use the same eased horizontal edge: particles begin moving where the mask first starts fading each glyph. Particles also follow the copy's vertical offset. Entering particles converge as text appears, and exiting particles scatter as text disappears. The shared math is tested in `scripts/hero-timeline-test.mjs`.

Dust now travels roughly 15–20% farther with a subtle 12px sideways curl. Its normal travel window spans 0.42 of the mask-edge range instead of 0.28 (50% longer), with a softer opacity envelope. The window narrows for the rightmost glyphs so they finish before the chapter boundary instead of disappearing abruptly. Canvas padding is 200px to accommodate the drift. Chapter ranges, direct scroll response, and particle cap remain unchanged. Fast scroll jumps can still skip intermediate frames.

While a fade is in progress, one animation-frame loop per active canvas adds a gentle time-based breeze (up to 14px sideways and 9px vertically). Dust therefore keeps moving when scrolling pauses, while text masks and particle opacity stay at the current scroll position. Movement tapers to zero at glyph endpoints. Reading holds, completed fades, hidden tabs, and unmounted layers stop the loop; reduced-motion/mobile paths remain static. This intentionally supersedes the earlier rule that all paused scrolling stops particle draws.

The mark is generated from the brand question-mark path as welded tube geometry plus a dot sphere. No external model or texture is needed. If this subject changes to a realistic object later, use an optimized GLB with normalized pivot, compressed textures, bounded polygon count, and measured download/render cost before replacing the procedural asset. A pre-rendered frame sequence would improve fixed photorealistic imagery but would lose responsive lighting and camera interaction; real-time geometry fits this abstract brand mark.

GSAP ScrollTrigger was considered for high-level progress. The existing Framer Motion scroll value already owns that progress and feeds a deterministic pure timeline; adding a second scroll controller would duplicate ownership without improving this scene. React/Vite remains the application foundation.

## Validation and limits

Run `npm ci`, `npm run build`, `npm run test:hero-timeline`, and `npm run test:consistency` from the repository root. The existing browser suite requires installed Chrome and a running preview server. Inspect desktop, mobile, reduced-motion, and WebGL fallback paths in a browser after visual changes. The lazy HeroScene bundle is approximately 895 kB minified; profile real devices before claiming a frame-rate target. No external 3D asset pipeline is needed for the current procedural mark.
