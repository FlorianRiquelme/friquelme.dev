import type { Object3D, PerspectiveCamera, Scene, Texture, WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { overviewDistanceScale, VERTICAL_FOV_DEGREES, NEAR_PLANE } from './framing';
import { parseManifest, validateProjectIdentity, validateSceneNodes, WorkshopAssetError, type WorkshopManifest } from './manifest';
import { workshopProjectIds } from './projects';
import {
  advanceRoute,
  INTERIOR_PROJECT_ID,
  isRouteSettled,
  nodeToView,
  retargetRoute,
  routeProgress,
  roomNode,
  settleRoute,
  settledRoute,
  viewToNode,
  type CameraNode,
  type RouteState,
  type WorkshopView,
} from './routing';

interface WorkshopElements {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  poster: HTMLImageElement;
  status: HTMLElement;
  readout: HTMLElement;
  overview: HTMLButtonElement;
  back: HTMLButtonElement;
  monitor: HTMLButtonElement;
  rotate: HTMLElement;
  rotateLeft: HTMLButtonElement;
  rotateRight: HTMLButtonElement;
  rotateReset: HTMLButtonElement;
  roomButtons: Map<string, HTMLButtonElement>;
  infoBlocks: HTMLElement[];
  controls: HTMLElement[];
}

interface CameraPose {
  position: import('three').Vector3;
  target: import('three').Vector3;
}

const CAMERA_NAMES: Record<Exclude<CameraNode, `room:${string}`>, [string, string]> = {
  overview: ['Cam_Overview', 'Aim_Overview'],
  approach: ['Cam_PortalApproach', 'Aim_PortalApproach'],
  cross: ['Cam_PortalCross', 'Aim_PortalCross'],
  interior: ['Cam_Interior', 'Aim_Interior'],
};

function readElements(root: HTMLElement): WorkshopElements | null {
  const canvas = root.querySelector('canvas[data-workshop-canvas]');
  const poster = root.querySelector('img[data-workshop-poster]');
  const status = root.querySelector('[data-workshop-status]');
  const readout = root.querySelector('[data-workshop-readout]');
  const overview = root.querySelector('button[data-workshop-overview]');
  const back = root.querySelector('button[data-workshop-back]');
  const monitor = root.querySelector('button[data-workshop-monitor]');
  const rotate = root.querySelector<HTMLElement>('[data-workshop-rotate-group]');
  const rotateLeft = root.querySelector('button[data-workshop-rotate="left"]');
  const rotateRight = root.querySelector('button[data-workshop-rotate="right"]');
  const rotateReset = root.querySelector('button[data-workshop-rotate="reset"]');
  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(poster instanceof HTMLImageElement) ||
    !(status instanceof HTMLElement) ||
    !(readout instanceof HTMLElement) ||
    !(overview instanceof HTMLButtonElement) ||
    !(back instanceof HTMLButtonElement) ||
    !(monitor instanceof HTMLButtonElement) ||
    !(rotate instanceof HTMLElement) ||
    !(rotateLeft instanceof HTMLButtonElement) ||
    !(rotateRight instanceof HTMLButtonElement) ||
    !(rotateReset instanceof HTMLButtonElement)
  ) {
    return null;
  }
  const roomButtons = new Map<string, HTMLButtonElement>();
  for (const button of root.querySelectorAll('button[data-workshop-room]')) {
    if (!(button instanceof HTMLButtonElement)) continue;
    const projectId = button.getAttribute('data-workshop-room');
    if (projectId) roomButtons.set(projectId, button);
  }
  const infoBlocks = [...root.querySelectorAll<HTMLElement>('[data-workshop-info]')];
  return {
    root,
    canvas,
    poster,
    status,
    readout,
    overview,
    back,
    monitor,
    rotate,
    rotateLeft,
    rotateRight,
    rotateReset,
    roomButtons,
    infoBlocks,
    controls: [...root.querySelectorAll<HTMLElement>('[data-workshop-controls]')],
  };
}

function viewKey(view: WorkshopView): string {
  if (view.kind === 'overview') return 'overview';
  if (view.kind === 'interior') return 'interior';
  return `room:${view.projectId}`;
}

function showFallback(elements: WorkshopElements): void {
  elements.root.dataset.workshopState = 'fallback';
  elements.root.classList.remove('is-ready', 'is-live');
  elements.root.classList.add('is-fallback');
  elements.canvas.hidden = true;
  elements.poster.hidden = false;
  elements.status.textContent = 'The 3D workshop could not load. The poster and the written work stay available.';
  for (const control of elements.controls) control.setAttribute('aria-disabled', 'true');
  for (const button of [elements.overview, elements.back, elements.monitor, elements.rotateLeft, elements.rotateRight, elements.rotateReset, ...elements.roomButtons.values()]) {
    button.disabled = true;
  }
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((entry) => values.has(entry));
}

function setStatus(elements: WorkshopElements, message: string): void {
  elements.status.textContent = message;
}

function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - (-2 * clamped + 2) ** 3 / 2;
}

export interface MountWorkshopOptions {
  root: HTMLElement;
}

export async function mountWorkshop({ root }: MountWorkshopOptions): Promise<void> {
  const elements = readElements(root);
  if (!elements) return;
  if (!sameMembers([...elements.roomButtons.keys()], workshopProjectIds)) {
    showFallback(elements);
    return;
  }

  let cleanup: (() => void) | undefined;
  let ready = false;
  const abort = new AbortController();
  window.addEventListener('pagehide', () => {
    if (!ready) abort.abort();
  }, { signal: abort.signal });
  try {
    elements.canvas.hidden = false;
    elements.root.classList.remove('is-fallback');
    elements.root.dataset.workshopState = 'loading';
    setStatus(elements, 'Preparing the 3D workshop.');
    const three = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    if (abort.signal.aborted) return;

    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let environmentTexture: Texture | null = null;
    let gltfScene: Object3D | null = null;
    let miniature: Object3D | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let frameRequest = 0;
    let disposed = false;
    let active = false;
    let inView = true;
    let lastFrame = 0;
    let dragging = false;
    let lastPointerX = 0;
    let miniatureRotation = 0;
    let miniatureBaseRotation = 0;
    let announcedNode = '';
    let focusAfterSettle: HTMLButtonElement | null = null;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = motionQuery.matches;
    let route: RouteState = settledRoute('overview');
    let requested: WorkshopView = { kind: 'overview' };
    const poses = new Map<CameraNode, CameraPose>();
    const fromPosition = new three.Vector3();
    const fromTarget = new three.Vector3();
    const toPosition = new three.Vector3();
    const toTarget = new three.Vector3();
    const lookTarget = new three.Vector3();

    const fail = () => {
      if (disposed) return;
      disposed = true;
      cancelFrame();
      abort.abort();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (scene) {
        scene.traverse((object) => {
          if (!(object instanceof three.Mesh)) return;
          object.geometry.dispose();
          const material = object.material;
          const materials = Array.isArray(material) ? material : [material];
          for (const entry of materials) {
            for (const value of Object.values(entry)) {
              if (value instanceof three.Texture) value.dispose();
            }
            entry.dispose();
          }
        });
      }
      environmentTexture?.dispose();
      renderer?.dispose();
      showFallback(elements);
    };
    cleanup = fail;

    const resize = () => {
      if (!renderer || !camera || !scene) return;
      const width = elements.canvas.clientWidth;
      const height = elements.canvas.clientHeight;
      if (width <= 0 || height <= 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      applyRoutePose();
      render();
    };

    const resolvePose = (node: CameraNode, position: import('three').Vector3, target: import('three').Vector3) => {
      const pose = poses.get(node);
      if (!pose) throw new WorkshopAssetError(`No pose for ${node}`);
      target.copy(pose.target);
      if (node === 'overview') {
        const scale = overviewDistanceScale(camera?.aspect ?? 1);
        position.copy(pose.position).sub(pose.target).multiplyScalar(scale).add(pose.target);
      } else {
        position.copy(pose.position);
      }
    };

    const applyRoutePose = () => {
      if (!camera) return;
      const progress = isRouteSettled(route) ? 1 : easeInOut(routeProgress(route));
      resolvePose(route.segment.start, fromPosition, fromTarget);
      resolvePose(route.segment.end, toPosition, toTarget);
      camera.position.lerpVectors(fromPosition, toPosition, progress);
      lookTarget.lerpVectors(fromTarget, toTarget, progress);
      camera.lookAt(lookTarget);
    };

    const render = () => {
      if (!renderer || !scene || !camera || disposed) return;
      renderer.render(scene, camera);
      elements.root.classList.add('is-live');
    };

    const focusTargetFor = (view: WorkshopView): HTMLButtonElement | null => {
      if (view.kind === 'overview') return elements.overview;
      if (view.kind === 'interior') return elements.monitor;
      return elements.roomButtons.get(view.projectId) ?? elements.overview;
    };

    const updateInfo = (view: WorkshopView) => {
      const wanted = viewKey(view);
      for (const block of elements.infoBlocks) {
        const kind = block.getAttribute('data-workshop-info');
        const projectId = block.getAttribute('data-workshop-project');
        const visible =
          kind === 'overview'
            ? view.kind === 'overview'
            : kind === 'interior'
              ? view.kind === 'interior'
              : kind === 'room' && view.kind === 'room' && view.projectId === projectId;
        block.hidden = !visible;
        if (visible) block.removeAttribute('aria-hidden');
        else block.setAttribute('aria-hidden', 'true');
      }
      elements.root.dataset.workshopInfo = wanted;
    };

    const syncControls = () => {
      elements.root.dataset.workshopState = ready ? 'ready' : 'loading';
      elements.root.dataset.workshopView = viewKey(requested);
      elements.root.dataset.workshopSelected = requested.kind === 'overview' ? 'false' : 'true';
      elements.root.dataset.workshopMotion = reduced ? 'reduce' : 'full';
      for (const [projectId, button] of elements.roomButtons) {
        button.disabled = !ready;
        button.setAttribute('aria-pressed', String(requested.kind === 'room' && requested.projectId === projectId));
      }
      elements.overview.disabled = !ready;
      elements.back.disabled = !ready || requested.kind === 'overview';
      const screengrabRoom = requested.kind === 'room' && requested.projectId === INTERIOR_PROJECT_ID;
      elements.monitor.hidden = !screengrabRoom;
      elements.monitor.disabled = !ready;
      elements.rotate.hidden = requested.kind !== 'interior';
      for (const button of [elements.rotateLeft, elements.rotateRight, elements.rotateReset]) button.disabled = !ready;
      elements.root.dataset.workshopTarget = viewToNode(requested);
      elements.readout.textContent = requested.kind === 'overview' ? 'overview' : requested.kind === 'interior' ? 'inside' : requested.projectId;
    };

    const settleIfDone = () => {
      if (!isRouteSettled(route)) return;
      const node = route.destination;
      if (announcedNode === node) {
        maybeFocus();
        return;
      }
      announcedNode = node;
      elements.root.dataset.workshopSettled = node;
      const view = nodeToView(node);
      updateInfo(view);
      if (view.kind === 'overview') {
        setStatus(elements, 'Overview of the workshop. Choose a room to enter.');
      } else if (view.kind === 'interior') {
        setStatus(elements, 'Inside the screengrab monitor. Drag or use the rotate buttons to turn the miniature.');
      } else {
        setStatus(
          elements,
          `${view.projectId} room. ${view.projectId === INTERIOR_PROJECT_ID ? 'Enter the monitor to go inside.' : 'Choose another room or return to overview.'}`,
        );
      }
      maybeFocus();
    };

    const maybeFocus = () => {
      if (!focusAfterSettle) return;
      const target = focusAfterSettle;
      focusAfterSettle = null;
      if (!target.isConnected || target.hidden || target.disabled) return;
      target.focus({ preventScroll: true });
    };

    const cancelFrame = () => {
      if (frameRequest !== 0) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    };

    const tick = (now: number) => {
      frameRequest = 0;
      if (disposed || reduced || !active || !ready) return;
      const delta = Math.min(64, Math.max(0, now - lastFrame));
      lastFrame = now;
      route = advanceRoute(route, delta);
      applyRoutePose();
      render();
      settleIfDone();
      if (!isRouteSettled(route) && !reduced && active && !disposed) frameRequest = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (frameRequest !== 0 || disposed || reduced || !active || !ready || isRouteSettled(route)) return;
      lastFrame = performance.now();
      frameRequest = requestAnimationFrame(tick);
    };

    const updateActive = () => {
      const next = inView && !document.hidden && !disposed;
      if (next === active) return;
      active = next;
      elements.root.dataset.workshopActive = String(active);
      if (active) schedule();
      else cancelFrame();
    };

    const requestView = (view: WorkshopView) => {
      if (!ready) return;
      requested = view;
      route = retargetRoute(route, viewToNode(view), workshopProjectIds);
      if (reduced) route = settleRoute(route);
      syncControls();
      if (view.kind === 'interior' && document.activeElement !== elements.back) {
        elements.back.focus({ preventScroll: true });
      }
      if (view.kind === 'overview') setStatus(elements, 'Returning to overview.');
      else if (view.kind === 'interior') setStatus(elements, 'Entering the monitor.');
      else setStatus(elements, `Moving to the ${view.projectId} room.`);
      if (reduced) {
        applyRoutePose();
        render();
        settleIfDone();
      } else {
        schedule();
      }
    };

    const goBack = () => {
      const next: WorkshopView = requested.kind === 'interior' ? { kind: 'room', projectId: INTERIOR_PROJECT_ID } : { kind: 'overview' };
      focusAfterSettle = focusTargetFor(next);
      requestView(next);
      if (reduced) maybeFocus();
    };

    const rotateMiniature = (delta: number) => {
      if (!miniature || requested.kind !== 'interior') return;
      miniatureRotation += delta;
      miniature.rotation.y = miniatureBaseRotation + miniatureRotation;
      render();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (requested.kind !== 'interior' || event.button !== 0) return;
      dragging = true;
      lastPointerX = event.clientX;
      elements.canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || requested.kind !== 'interior') return;
      const delta = event.clientX - lastPointerX;
      lastPointerX = event.clientX;
      if (Math.abs(delta) < 0.1) return;
      rotateMiniature(delta * 0.012);
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (elements.canvas.hasPointerCapture(event.pointerId)) elements.canvas.releasePointerCapture(event.pointerId);
    };

    const onMotionChange = () => {
      reduced = motionQuery.matches;
      elements.root.dataset.workshopMotion = reduced ? 'reduce' : 'full';
      if (reduced) {
        route = settleRoute(route);
        applyRoutePose();
        render();
        settleIfDone();
        cancelFrame();
      } else {
        schedule();
      }
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      fail();
    };

    const loadManifest = async (): Promise<WorkshopManifest> => {
      const response = await fetch('/workshop/manifest.json', { headers: { accept: 'application/json' }, signal: abort.signal });
      if (!response.ok) throw new WorkshopAssetError(`Manifest request failed with ${response.status}`);
      return parseManifest(await response.json());
    };

    const manifest = await loadManifest();
    validateProjectIdentity(manifest, workshopProjectIds);

    renderer = new three.WebGLRenderer({ canvas: elements.canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.outputColorSpace = three.SRGBColorSpace;
    renderer.toneMapping = three.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x0c0c0c, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = three.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;

    scene = new three.Scene();
    scene.background = new three.Color(0x0c0c0c);
    camera = new three.PerspectiveCamera(VERTICAL_FOV_DEGREES, 1, NEAR_PLANE, 120);

    const pmrem = new three.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environmentTexture = pmrem.fromScene(room, 0.04).texture;
    scene.environment = environmentTexture;
    scene.environmentIntensity = 0.28;
    room.dispose();
    pmrem.dispose();

    setStatus(elements, 'Loading the workshop geometry.');
    const loader = new GLTFLoader();
    const response = await fetch(manifest.asset, { signal: abort.signal });
    if (!response.ok) throw new WorkshopAssetError(`Geometry request failed with ${response.status}`);
    const gltf: GLTF = await loader.parseAsync(await response.arrayBuffer(), '/workshop/');
    if (abort.signal.aborted) { fail(); return; }
    gltfScene = gltf.scene;
    scene.add(gltfScene);
    gltfScene.updateMatrixWorld(true);

    const sceneNames: string[] = [];
    gltfScene.traverse((object) => {
      if (object.name) sceneNames.push(object.name);
    });
    validateSceneNodes(manifest, sceneNames);

    gltfScene.traverse((object) => {
      if (object instanceof three.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const worldPose = (cameraName: string, aimName: string): CameraPose => {
      const cameraAnchor = gltfScene?.getObjectByName(cameraName);
      const aimAnchor = gltfScene?.getObjectByName(aimName);
      if (!cameraAnchor || !aimAnchor) throw new WorkshopAssetError(`Scene is missing ${cameraName} or ${aimName}`);
      return { position: cameraAnchor.getWorldPosition(new three.Vector3()), target: aimAnchor.getWorldPosition(new three.Vector3()) };
    };

    for (const projectId of workshopProjectIds) {
      poses.set(roomNode(projectId), worldPose(`Cam_Room_${projectId}`, `Aim_Room_${projectId}`));
    }
    for (const key of ['overview', 'approach', 'cross', 'interior'] as const) {
      const [cameraName, aimName] = CAMERA_NAMES[key];
      poses.set(key, worldPose(cameraName, aimName));
    }

    const overviewPose = poses.get('overview');
    if (!overviewPose) throw new WorkshopAssetError('Overview aim is missing');

    const hemisphere = new three.HemisphereLight(0xfff0da, 0x0c0c0c, 0.42);
    scene.add(hemisphere);
    const keyLight = new three.DirectionalLight(0xffdfbc, 2.8);
    keyLight.position.copy(gltfScene.getObjectByName('Light_Key')!.getWorldPosition(new three.Vector3()));
    keyLight.target.position.copy(overviewPose.target);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    Object.assign(keyLight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.1, far: 40 });
    keyLight.shadow.normalBias = 0.003;
    keyLight.shadow.camera.updateProjectionMatrix();
    scene.add(keyLight);
    scene.add(keyLight.target);
    const rim = new three.DirectionalLight(0xffbe80, 1.4);
    rim.position.copy(gltfScene.getObjectByName('Light_Rim')!.getWorldPosition(new three.Vector3()));
    rim.target.position.copy(overviewPose.target);
    scene.add(rim, rim.target);
    const interiorLight = new three.PointLight(0xffc68b, 0.03, 0.8, 2);
    interiorLight.position.copy(gltfScene.getObjectByName('Light_Interior')!.getWorldPosition(new three.Vector3()));
    scene.add(interiorLight);

    const mini = gltfScene.getObjectByName('MiniatureWorkshop');
    if (!(mini instanceof three.Object3D)) throw new WorkshopAssetError('Scene is missing MiniatureWorkshop');
    miniature = mini;
    miniatureBaseRotation = miniature.rotation.y;
    miniature.traverse(object => {
      if (object instanceof three.Mesh) object.castShadow = false;
    });

    renderer.shadowMap.needsUpdate = true;
    resize();
    ready = true;
    active = false;
    inView = true;
    syncControls();
    updateInfo({ kind: 'overview' });
    elements.root.classList.add('is-ready');
    setStatus(elements, 'Overview of the workshop. Choose a room to enter.');

    for (const [projectId, button] of elements.roomButtons) {
      button.addEventListener(
        'click',
        () => {
          focusAfterSettle = null;
          requestView({ kind: 'room', projectId });
        },
        { signal: abort.signal },
      );
    }
    elements.overview.addEventListener(
      'click',
      () => {
        focusAfterSettle = null;
        requestView({ kind: 'overview' });
      },
      { signal: abort.signal },
    );
    elements.monitor.addEventListener(
      'click',
      () => {
        focusAfterSettle = null;
        requestView({ kind: 'interior' });
      },
      { signal: abort.signal },
    );
    elements.back.addEventListener(
      'click',
      () => {
        goBack();
      },
      { signal: abort.signal },
    );
    elements.rotateLeft.addEventListener('click', () => rotateMiniature(-Math.PI / 6), { signal: abort.signal });
    elements.rotateRight.addEventListener('click', () => rotateMiniature(Math.PI / 6), { signal: abort.signal });
    elements.rotateReset.addEventListener(
      'click',
      () => {
        if (!miniature) return;
        miniatureRotation = 0;
        miniature.rotation.y = miniatureBaseRotation;
        render();
      },
      { signal: abort.signal },
    );
    elements.root.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || requested.kind === 'overview' || event.defaultPrevented) return;
        event.preventDefault();
        goBack();
      },
      { signal: abort.signal },
    );
    elements.canvas.addEventListener('pointerdown', onPointerDown, { signal: abort.signal });
    elements.canvas.addEventListener('pointermove', onPointerMove, { signal: abort.signal });
    elements.canvas.addEventListener('pointerup', endDrag, { signal: abort.signal });
    elements.canvas.addEventListener('pointercancel', endDrag, { signal: abort.signal });
    elements.canvas.addEventListener('webglcontextlost', onContextLost, { signal: abort.signal });
    motionQuery.addEventListener('change', onMotionChange, { signal: abort.signal });
    document.addEventListener('visibilitychange', updateActive, { signal: abort.signal });

    for (const enter of document.querySelectorAll<HTMLElement>('[data-workshop-enter]')) {
      enter.addEventListener(
        'click',
        (event) => {
          event.preventDefault();
          focusAfterSettle = elements.roomButtons.get(INTERIOR_PROJECT_ID) ?? null;
          requestView({ kind: 'room', projectId: INTERIOR_PROJECT_ID });
          elements.root.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        },
        { signal: abort.signal },
      );
    }

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(elements.canvas);
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        updateActive();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(elements.root);
    elements.root.dataset.workshopState = 'ready';
    elements.root.dataset.workshopMotion = reduced ? 'reduce' : 'full';
    elements.root.dataset.workshopSettled = 'overview';
    render();
    updateActive();
    applyRoutePose();
    if (elements.root.dataset.workshopEnterPending === 'room:screengrab') {
      delete elements.root.dataset.workshopEnterPending;
      requestView({ kind: 'room', projectId: INTERIOR_PROJECT_ID });
    }

  } catch {
    cleanup?.();
    if (elements.root.dataset.workshopState !== 'fallback') showFallback(elements);
  }
}
