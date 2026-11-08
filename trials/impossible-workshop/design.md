# Impossible workshop implementation contract

Florian approved the generated impossible workshop and recursive desktop concepts, then authorized autonomous implementation. The objective is a real, visually rich browser scene that visitors can explore while all portfolio content remains directly accessible.

## Accepted design

Use one Blender-authored glTF scene and one Three.js camera. The featured screengrab monitor has a physical opening into a miniature interior. The camera moves continuously through that opening. The interior desk holds a geometry-sharing miniature of the exterior. A drag gesture or keyboard buttons can rotate that miniature.

The architectural review compared three candidates. The separate gpt-6-sol cross-judge recommended the Sol candidate, with Astra's adjacent-route reversal rule and versioned asset validation. Parent accepts that choice. The fourth configured candidate could not start because native agent capacity was full. All three completed candidates independently selected one physical scene. A render-to-texture portal and disconnected scenes were rejected for this delivery because they add synchronization and clipping complexity without improving the single featured journey.

## Ownership

`src/data/projects.ts` owns project facts. Derive project IDs from canonical repository URL suffixes. Do not maintain a second list of project descriptions or URLs.

`Workshop.astro` owns semantic HTML, scene controls, project information and fallback. `src/lib/workshop/` owns the enhancement, with one public mount function and one state owner. Keep camera path policy testable independently of Three.js. No framework or animation-library dependency is needed.

The domain has `overview`, `room(projectId)` and `interior` views. Only screengrab has an interior. Loading, transition and fallback are explicit lifecycle states. The route is overview to room, then screengrab room to portal approach to portal cross to interior. Changing projects from the interior first traverses back out. Input replaces the requested destination and reverses or finishes the active adjacent edge. Never interpolate directly through a wall. Requested and settled views are distinct. Back, repeated input, Escape and reduced-motion changes must not strand controls.

`scripts/build-workshop.py` owns the reproducible Blender model and export. The parent builds assets. The frontend worker owns homepage components, rendering, styles, tests and dependency inputs. Changes are integrated from separate worktrees.

## Frozen asset contract

Files are `/workshop/workshop.glb`, `/workshop/manifest.json`, `/workshop/poster.webp`. The generated concept art can supply the initial poster while the actual scene renders. Do not imply that poster pixels are geometry. The Blender source and render script remain reproducible.

Blender authors Z-up metres. Standard glTF export converts once to Y-up. The runtime loads at identity and resolves world positions from named empty nodes; it must not hardcode or convert those positions again.

Required nodes:

- `WorkshopRoot`, the outer geometry parent.
- `Cam_Overview` and `Aim_Overview`.
- `Room_<id>`, `Cam_Room_<id>`, `Aim_Room_<id>` and `Hotspot_<id>` for every canonical project ID.
- `Cam_PortalApproach`, `Aim_PortalApproach`, `Cam_PortalCross`, `Aim_PortalCross`, `Cam_Interior`, `Aim_Interior`.
- `MonitorAperture`, an empty at the opening centre with width and height numeric extras, facing glTF +Z.
- `MiniatureWorkshop`, the rotatable interior copy.
- `Light_Key`, `Light_Rim` and `Light_Interior`, the authored light positions.

The manifest has `schemaVersion: 1`, `asset: '/workshop/workshop.glb'`, `projectIds`, `nodes` as an array of required node names, `stats` containing triangles and file bytes, and `aperture` with width, height and nearPlane. Camera and aim transforms are only in GLB. Use camera vertical FOV 42 degrees and near plane 0.002 metres. Derive portrait framing for overview from aspect ratio. Portal traversal uses the same centreline at all aspect ratios. The opening is wider and taller than the near-plane frustum at the crossing, including the widest supported viewport.

The exterior can be a single mesh per material to bound draw calls. Room markers remain separate named empties. Selection through HTML controls is mandatory; projected hotspots and raycasting are optional additions. Interior walls and the monitor casing occlude the exterior appropriately. The aperture has no opaque screen across it. All fonts, textures and meshes are served locally. No CDN script or remote texture dependency.

## Acceptance and verification

1. Homepage headline, profile, all seven projects, blog and contact are visible and usable without WebGL or JavaScript.
2. The scene loads an actual GLB. Entering the workshop and selecting screengrab changes the rendered camera view. Entering the monitor reveals the interior and miniature through a continuous path. Back reverses that path.
3. Rapid enter/back/select actions settle at the last valid requested destination. Focus returns to the invoking control, and a persistent overview control is available.
4. Keyboard, touch and 320px layouts work. Reduced motion changes views immediately and disables ambient movement. Context or asset failure leaves the poster and ordinary content usable.
5. No horizontal overflow, missing assets, uncaught browser errors or automated WCAG violations on the supported target matrix.
6. Preserve all current project destinations, article routes, metadata, RSS and contact addresses. Retain the existing header navigation labels and section IDs for compatibility.
7. Both `verify` and `verify:infra` pass. Independent review must pass on the pushed head before the merge guard runs.

## Legacy assertion mapping

| Existing assertion | Replacement contract |
| --- | --- |
| Exact hero terminal commands and biography | Visible profile prose preserves identity, employer, place, experience and tool focus. Decorative shell commands are intentionally retired. |
| Exact contact JSON | Visible, directly clickable email and profile addresses. JSON punctuation is intentionally retired. |
| Ordinary-motion typing completion | Visible initial content plus completed scene entrance, portal traversal and exit. |
| Reduced-motion immediate terminal content | Visible initial content plus immediate camera destination settlement and no ambient motion. |
| Hero opacity reaches one | Headline and actions are visible on initial render, including no JavaScript. |
| Project destinations, section navigation, blog journeys, sitemap and metadata | Preserve the exact assertions. |

The new visual direction supersedes the former single-font and purely terminal presentation rules. Infrastructure and article content remain outside this implementation's scope.

## Integration decisions

The Blender preview and browser both use a 42-degree vertical field of view. Overview composition is authored in the asset; the browser only adjusts distance for portrait aspect ratios. Baked vertex ambient shading preserves contact depth. A cached directional shadow map and bounded interior light replace the initial light-layer approach: Three.js light layers filter cameras, not individual illuminated meshes. The rotating miniature receives exterior shadows but does not invalidate the static shadow map.

Rendering is on demand. Camera transitions schedule frames; resizing, miniature rotation and preference changes draw when needed. A settled scene schedules no continuous ambient loop. Project articles are plain visible HTML, including when enhancement scripts are blocked. The public mount function owns the page-lifetime enhancement and releases resources on rendering failure.

The browser gate enables Firefox's documented `webgl.force-enabled` preference through its Playwright launch API. Without it, Firefox in the isolated Linux environment rejects WebGL 2 before the asset loads. TesterArmy 0.11.2 has no launch-preferences option, so the existing process-wide target registry installs this narrowly scoped launch adapter once. This does not change visitors' browsers or weaken the interaction assertions.

## Rebuilding the asset

Use the repository's Node 24 runtime and install dependencies first. Generate the project catalog with `node scripts/export-workshop-catalog.mjs`. Then run Blender 5.2 in background mode with `--python-exit-code 1 --python scripts/build-workshop.py -- --catalog .planning/workshop/catalog.json --out public/workshop --renders reports/workshop`. The script builds and exports geometry, anchors, vertex shading, manifest and reference renders. HIP is used when available; CPU rendering remains available.

Convert `reports/workshop/Overview.png` to `public/workshop/poster.webp` with the installed sharp library at quality 88. `tests/workshop/asset.test.ts` loads the real GLB and checks project identity, required anchors, both directions of the camera paths, portal placement, shared miniature geometry, vertex shading, reported size and triangle count, and poster decoding. The Blender source is the generator; the large intermediate `.blend` stays in the ignored reports directory.
