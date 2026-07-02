"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./target-mode.css";

type TargetItem = {
  targetPath: string;
  technicalElement: string;
  visibleText?: string;
  semanticDescription?: string;
};

type OverlayBox = {
  key: string;
  top: number;
  left: number;
  width: number;
  height: number;
  labelTop: number;
  labelLeft: number;
  label: string;
};

const TARGET_MODE_ROOT_ATTR = "data-target-mode-root";
const TARGET_MODE_IGNORE_ATTR = "data-target-mode-ignore";
const TARGET_MODE_SCOPE_ATTR = "data-target-mode-scope";
const DATA_INSPECT_PATH = "data-inspect-path";
const DATA_INSPECT_LABEL = "data-inspect-label";
const DATA_INSPECT_ELEMENT = "data-inspect-element";
const DATA_INSPECT_DESCRIPTION = "data-inspect-description";
const DATA_INSPECT_ASSOCIATED_TEXT = "data-inspect-associated-text";
const MIN_USEFUL_RECT_SIZE = 4;
const MAX_LABEL_WIDTH = 320;
const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");
const SVG_INTERNAL_TAGS = new Set([
  "circle",
  "clippath",
  "defs",
  "ellipse",
  "g",
  "line",
  "mask",
  "path",
  "polygon",
  "polyline",
  "rect",
  "symbol",
  "text",
  "use",
]);

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function quoteClipboardValue(value: string): string {
  return value.replace(/"/g, "'");
}

function slugifyLabel(value: string): string {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function getDomTarget(element: Element): string {
  return element.tagName.toLowerCase();
}

function normalizeTarget(node: Element | null): Element | null {
  if (!node) return null;
  if (node.closest(`[${TARGET_MODE_IGNORE_ATTR}]`)) return null;

  return getPrimaryInspectTarget(node);
}

function getPointTarget(clientX: number, clientY: number): Element | null {
  return normalizeTarget(document.elementFromPoint(clientX, clientY));
}

function getEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) return normalizeTarget(target);
  if (target instanceof Text && target.parentElement) return normalizeTarget(target.parentElement);
  return null;
}

function getNearestInteractiveAncestor(element: Element): Element | null {
  return element.closest(INTERACTIVE_SELECTOR);
}

function getPrimaryInspectTarget(element: Element): Element {
  const tag = getDomTarget(element);
  const svgElement = tag === "svg" ? element : element.closest("svg");
  const isSvgInternalNode = SVG_INTERNAL_TAGS.has(tag) && !!svgElement;

  if (!isSvgInternalNode && tag !== "svg") return element;

  const interactiveAncestor = getNearestInteractiveAncestor(element);
  if (interactiveAncestor && svgElement && interactiveAncestor.contains(svgElement)) {
    return interactiveAncestor;
  }

  return svgElement ?? element;
}

function getClosestAttribute(element: Element, attribute: string): string {
  const closest = element.closest(`[${attribute}]`);
  return closest?.getAttribute(attribute) ?? "";
}

function getClosestOptionalAttribute(element: Element, attribute: string): string {
  return normalizeText(getClosestAttribute(element, attribute));
}

function getClosestAttributeFromList(element: Element, attributes: string[]): string {
  for (const attribute of attributes) {
    const value = getClosestOptionalAttribute(element, attribute);
    if (value) return value;
  }

  return "";
}

function getUsefulBoxElement(element: Element): Element {
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const rect = current.getBoundingClientRect();
    if (rect.width >= MIN_USEFUL_RECT_SIZE && rect.height >= MIN_USEFUL_RECT_SIZE) {
      return current;
    }

    current = current.parentElement;
  }

  return element;
}

function getReadableText(element: Element): string {
  const text = normalizeText(element.textContent);
  if (!text || text.length > 64) return "";
  if (text.split(" ").length > 8) return "";
  return text;
}

function getVisibleText(element: Element): string {
  const text = normalizeText(element.textContent);
  if (!text) return "";
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function getElementLabel(element: Element): string {
  const inputElement = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : null;
  const imageElement = element instanceof HTMLImageElement ? element : null;
  const label =
    element.getAttribute(DATA_INSPECT_LABEL) ||
    element.getAttribute("aria-label") ||
    element.getAttribute("data-tooltip") ||
    element.getAttribute("title") ||
    imageElement?.alt ||
    inputElement?.placeholder ||
    inputElement?.name ||
    getReadableText(element);

  return normalizeText(label);
}

function getExplicitElementId(element: Element): string {
  const explicit =
    element.getAttribute(DATA_INSPECT_ELEMENT) ||
    element.getAttribute("data-target-mode-id") ||
    element.getAttribute("data-dev-element-id") ||
    element.getAttribute("data-testid") ||
    element.getAttribute("data-test-id") ||
    element.getAttribute("data-cy") ||
    element.getAttribute("data-dev-element") ||
    element.id;

  return slugifyLabel(explicit || "");
}

function getElementKind(element: Element): string {
  const tag = getDomTarget(element);
  const role = element.getAttribute("role");

  if (tag === "button" || role === "button") return "button";
  if (tag === "a" || role === "link") return "link";
  if (tag === "input") return "input";
  if (tag === "textarea") return "textarea";
  if (tag === "select") return "select";
  if (tag === "img") return "image";
  if (tag === "svg" || tag === "path" || tag === "p-icon") return "icon";
  if (tag === "td" || tag === "th") return "cell";
  if (tag === "tr") return "row";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "label" || tag === "span") return "label";
  return "";
}

function withElementKind(label: string, element: Element): string {
  const slug = slugifyLabel(label);
  const kind = getElementKind(element);

  if (!slug) return "";
  if (!kind || slug.endsWith(`-${kind}`) || slug === kind) return slug;

  return `${slug}-${kind}`;
}

function getSemanticScope(element: Element): Element | null {
  return element.closest(`[${TARGET_MODE_SCOPE_ATTR}], [data-dev-inspectable="true"]`);
}

function getSemanticElementId(target: Element): string {
  const semanticScope = getSemanticScope(target);
  let current: Element | null = target;

  while (current && current !== document.documentElement) {
    const explicitElementId = getExplicitElementId(current);
    if (explicitElementId) return explicitElementId;

    const label = getElementLabel(current);
    const labeledElementId = withElementKind(label, current);
    if (labeledElementId) return labeledElementId;

    if (current === semanticScope) break;
    current = current.parentElement;
  }

  return getDomTarget(target);
}

function getTargetPathSegment(target: Element): string {
  const kind = getElementKind(target);
  const elementId = getSemanticElementId(target);
  const finalTarget = kind ? `${kind}:${elementId}` : elementId;

  return `alvo-final:'${finalTarget}'`;
}

function getStructuredTargetPath(target: Element): string {
  const page = getClosestAttributeFromList(target, ["data-target-mode-page", "data-dev-page"]);
  const section = getClosestAttributeFromList(target, ["data-target-mode-section", "data-dev-section"]);
  const component = getClosestAttributeFromList(target, ["data-target-mode-component", "data-dev-component"]);

  if (!page && !section && !component) return "";

  return [
    page ? `page:${page}` : "",
    section ? `section:${section}` : "",
    component ? `component:${component}` : "",
    getTargetPathSegment(target),
  ]
    .filter(Boolean)
    .join(" > ");
}

function getElementName(element: Element): string {
  const label = getElementLabel(element);
  if (label) return label;

  if (element.id) return `#${element.id}`;

  const testId =
    element.getAttribute("data-testid") ||
    element.getAttribute("data-test-id") ||
    element.getAttribute("data-cy");
  if (testId) return `[${testId}]`;

  const className = typeof element.className === "string" ? element.className : element.getAttribute("class") || "";
  const usefulClass = className
    .split(/\s+/)
    .find((part) => part && !/^(active|selected|disabled|loading|open|closed)$/i.test(part));

  return usefulClass ? `${getDomTarget(element)}.${usefulClass}` : getDomTarget(element);
}

function getTargetPath(element: Element): string {
  const explicitPath = normalizeText(element.getAttribute(DATA_INSPECT_PATH) || getClosestAttribute(element, DATA_INSPECT_PATH));
  if (explicitPath) return explicitPath;

  const structuredPath = getStructuredTargetPath(element);
  if (structuredPath) return structuredPath;

  const segments: string[] = [];
  let current = element.parentElement;

  while (current && current !== document.body && current !== document.documentElement) {
    if (current.hasAttribute(TARGET_MODE_ROOT_ATTR) || current.hasAttribute(TARGET_MODE_IGNORE_ATTR)) break;

    segments.unshift(getElementName(current));
    if (current.hasAttribute(TARGET_MODE_SCOPE_ATTR)) break;

    current = current.parentElement;
  }

  return [...segments, getTargetPathSegment(element)].filter(Boolean).join(" > ");
}

function getAssociatedVisibleText(target: Element): string {
  const explicitText = getClosestOptionalAttribute(target, DATA_INSPECT_ASSOCIATED_TEXT);
  if (explicitText) return explicitText;

  const ownText = getReadableText(target);
  if (ownText) return ownText;

  const semanticScope = getSemanticScope(target);
  let current = target.parentElement;

  while (current && current !== semanticScope && current !== document.body) {
    const text = getVisibleText(current);
    if (text && text.length <= 140) return text;
    current = current.parentElement;
  }

  return "";
}

function getSemanticDescription(target: Element): string {
  const explicitDescription = getClosestOptionalAttribute(target, DATA_INSPECT_DESCRIPTION);
  if (explicitDescription) return explicitDescription;

  const label = getElementLabel(target);
  const associatedText = getAssociatedVisibleText(target);
  if (!label || label === associatedText) return "";

  return label;
}

function getTechnicalElement(element: Element): string {
  const parts = [getDomTarget(element)];

  if (element.id) parts.push(`#${element.id}`);

  const testId =
    element.getAttribute("data-testid") ||
    element.getAttribute("data-test-id") ||
    element.getAttribute("data-cy");
  if (testId) parts.push(`[data-testid="${testId}"]`);

  const role = element.getAttribute("role");
  if (role) parts.push(`[role="${role}"]`);

  const className = typeof element.className === "string" ? element.className : element.getAttribute("class") || "";
  const classes = className
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => `.${part}`);

  return [...parts, ...classes].join("");
}

function getOverlayLabel(element: Element): string {
  return `${getSemanticElementId(element)} | ${getDomTarget(element)}`;
}

function createTargetItem(element: Element): TargetItem {
  const visibleText = getAssociatedVisibleText(element);
  const semanticDescription = getSemanticDescription(element);

  return {
    targetPath: getTargetPath(element),
    technicalElement: getTechnicalElement(element),
    ...(visibleText ? { visibleText } : {}),
    ...(semanticDescription ? { semanticDescription } : {}),
  };
}

function createOverlayBox(element: Element): OverlayBox | null {
  const visualElement = getUsefulBoxElement(element);
  const rect = visualElement.getBoundingClientRect();

  if (rect.width < MIN_USEFUL_RECT_SIZE || rect.height < MIN_USEFUL_RECT_SIZE) return null;

  const targetPath = getTargetPath(element);
  const visibleText = getAssociatedVisibleText(element);
  const labelTop = rect.top > 31 ? rect.top - 29 : rect.bottom + 7;
  const labelLeft = Math.min(Math.max(rect.left, 8), Math.max(8, window.innerWidth - MAX_LABEL_WIDTH - 8));

  return {
    key: `${targetPath}::${visibleText}::${Math.round(rect.top)}::${Math.round(rect.left)}`,
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    labelTop,
    labelLeft,
    label: getOverlayLabel(element),
  };
}

function formatClipboard(items: TargetItem[]): string {
  if (items.length === 1) {
    return formatSingleItem(items[0], 1);
  }

  return [
    "O usuario apontou multiplos objetos. Cada item tem seu proprio targetPath hierarquico; o ultimo segmento do targetPath e sempre o alvo final exato a ser modificado.",
    ...items.map((item, index) => formatSingleItem(item, index + 1)),
  ].join("\n\n");
}

function formatSingleItem(item: TargetItem, index: number): string {
  const fields = [
    `O Item ${index} apontado pelo usuario usa exatamente o targetPath hierarquico: "${quoteClipboardValue(item.targetPath)}"`,
    `o elemento tecnico real clicado e "${quoteClipboardValue(item.technicalElement)}"`,
  ];

  if (item.visibleText) {
    fields.push(`o texto visivel associado ao alvo e "${quoteClipboardValue(item.visibleText)}"`);
  }

  if (item.semanticDescription) {
    fields.push(`a descricao semantica do alvo e "${quoteClipboardValue(item.semanticDescription)}"`);
  }

  return `${fields.join("; ")}.`;
}

async function copyTargets(items: TargetItem[]) {
  const text = formatClipboard(items);

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for previews or embedded browsers that expose the API but reject permission.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function TargetMode() {
  const [enabled, setEnabled] = useState(false);
  const [hoverBox, setHoverBox] = useState<OverlayBox | null>(null);
  const [selectedBoxes, setSelectedBoxes] = useState<OverlayBox[]>([]);
  const [lastCopiedAt, setLastCopiedAt] = useState<number | null>(null);
  const [copiedCount, setCopiedCount] = useState(0);
  const [copyFailed, setCopyFailed] = useState(false);
  const selectedRef = useRef<TargetItem[]>([]);
  const selectedTargetsRef = useRef<Element[]>([]);
  const hoverTargetRef = useRef<Element | null>(null);
  const suppressClickUntilRef = useRef(0);

  const refreshSelectedBoxes = useCallback(() => {
    selectedTargetsRef.current = selectedTargetsRef.current.filter((element) => document.contains(element));
    const nextBoxes = selectedTargetsRef.current.map(createOverlayBox).filter((box): box is OverlayBox => Boolean(box));
    setSelectedBoxes(nextBoxes);
    return nextBoxes;
  }, []);

  const updateHoverFromTarget = useCallback((target: Element | null) => {
    hoverTargetRef.current = target;
    setHoverBox(target ? createOverlayBox(target) : null);
  }, []);

  const statusText = useMemo(() => {
    if (!enabled) return "";
    if (copyFailed) return "Copy failed";
    if (!lastCopiedAt) return "Target mode active";
    return `Copied ${copiedCount} target${copiedCount === 1 ? "" : "s"}`;
  }, [enabled, copyFailed, lastCopiedAt, copiedCount]);

  const inspectTarget = useCallback(
    (target: Element | null, appendSelection: boolean) => {
      if (!target || target === document.documentElement || target === document.body) return;

      const targetBox = createOverlayBox(target);
      if (!targetBox) return;

      selectedTargetsRef.current = appendSelection
        ? [...selectedTargetsRef.current.filter((entry) => createOverlayBox(entry)?.key !== targetBox.key), target]
        : [target];

      const nextBoxes = refreshSelectedBoxes();
      selectedRef.current = selectedTargetsRef.current.map(createTargetItem);
      updateHoverFromTarget(target);

      setCopiedCount(nextBoxes.length);
      setCopyFailed(false);

      copyTargets(selectedRef.current)
        .then(() => setLastCopiedAt(Date.now()))
        .catch(() => {
          setCopyFailed(true);
          setLastCopiedAt(Date.now());
        });
    },
    [refreshSelectedBoxes, updateHoverFromTarget],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "h" && !event.repeat) {
        event.preventDefault();
        setEnabled((current) => {
          if (current) {
            selectedRef.current = [];
            selectedTargetsRef.current = [];
            hoverTargetRef.current = null;
            setSelectedBoxes([]);
            setCopiedCount(0);
            setCopyFailed(false);
            setHoverBox(null);
          }

          return !current;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function stopTargetModeEvent(event: Event, preventDefault = true) {
      if (preventDefault) event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function onPointerMove(event: PointerEvent) {
      updateHoverFromTarget(getPointTarget(event.clientX, event.clientY));
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;

      stopTargetModeEvent(event);
      suppressClickUntilRef.current = performance.now() + 650;
      inspectTarget(getPointTarget(event.clientX, event.clientY) ?? getEventTarget(event.target), event.ctrlKey || event.metaKey);
    }

    function onBlockedMouseEvent(event: MouseEvent) {
      stopTargetModeEvent(event);
    }

    function onClick(event: MouseEvent) {
      stopTargetModeEvent(event);

      if (performance.now() < suppressClickUntilRef.current) return;
      inspectTarget(getPointTarget(event.clientX, event.clientY) ?? getEventTarget(event.target), event.ctrlKey || event.metaKey);
    }

    function onScrollOrResize() {
      updateHoverFromTarget(hoverTargetRef.current);
      refreshSelectedBoxes();
    }

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("mousedown", onBlockedMouseEvent, true);
    window.addEventListener("mouseup", onBlockedMouseEvent, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("dblclick", onBlockedMouseEvent, true);
    window.addEventListener("auxclick", onBlockedMouseEvent, true);
    window.addEventListener("contextmenu", onBlockedMouseEvent, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);
    document.body.classList.add("target-mode-enabled");

    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("mousedown", onBlockedMouseEvent, true);
      window.removeEventListener("mouseup", onBlockedMouseEvent, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("dblclick", onBlockedMouseEvent, true);
      window.removeEventListener("auxclick", onBlockedMouseEvent, true);
      window.removeEventListener("contextmenu", onBlockedMouseEvent, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize, true);
      document.body.classList.remove("target-mode-enabled");
      selectedTargetsRef.current = [];
      hoverTargetRef.current = null;
      setHoverBox(null);
      setSelectedBoxes([]);
    };
  }, [enabled, inspectTarget, refreshSelectedBoxes, updateHoverFromTarget]);

  if (!enabled) return null;

  const visibleHoverBox = hoverBox && !selectedBoxes.some((box) => box.key === hoverBox.key) ? hoverBox : null;

  return (
    <div className="target-mode-layer" data-target-mode-root data-target-mode-ignore>
      {selectedBoxes.map((box) => (
        <div key={box.key}>
          <div
            className="target-mode-selected-box"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
            }}
          />
          <div
            className="target-mode-selected-label"
            style={{
              top: box.labelTop,
              left: box.labelLeft,
            }}
          >
            {box.label}
          </div>
        </div>
      ))}
      {visibleHoverBox && (
        <>
          <div
            className="target-mode-box"
            style={{
              top: visibleHoverBox.top,
              left: visibleHoverBox.left,
              width: visibleHoverBox.width,
              height: visibleHoverBox.height,
            }}
          />
          <div
            className="target-mode-label"
            style={{
              top: visibleHoverBox.labelTop,
              left: visibleHoverBox.labelLeft,
            }}
          >
            {visibleHoverBox.label}
          </div>
        </>
      )}
      <div className="target-mode-badge" aria-live="polite">
        {statusText}
      </div>
    </div>
  );
}
