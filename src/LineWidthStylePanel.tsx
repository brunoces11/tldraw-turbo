import {
  ArrowShapeArrowheadEndStyle,
  ArrowShapeArrowheadStartStyle,
  ArrowShapeKindStyle,
  ArrowheadStylePickerSet,
  CommonStylePickerSet,
  DefaultFontStyle,
  DefaultSizeStyle,
  DefaultStylePanel,
  GeoShapeGeoStyle,
  GeoStylePickerSet,
  getDefaultColorTheme,
  kickoutOccludedShapes,
  LineShapeSplineStyle,
  SplineStylePickerSet,
  STROKE_SIZES,
  TextStylePickerSet,
  TldrawUiButtonIcon,
  TldrawUiButtonLabel,
  TldrawUiMenuContextProvider,
  TldrawUiPopover,
  TldrawUiPopoverContent,
  TldrawUiPopoverTrigger,
  TldrawUiSlider,
  TldrawUiToolbar,
  TldrawUiToolbarButton,
  tlmenus,
  type ReadonlySharedStyleMap,
  type SharedStyle,
  type TLDefaultSizeStyle,
  type TLShape,
  type TLShapePartial,
  type TLUiIconType,
  type TLUiStylePanelProps,
  useEditor,
  useIsDarkMode,
  useRelevantStyles,
  useTranslation,
  useValue,
} from "tldraw";
import { useCallback, useState } from "react";

const LINE_WIDTH_MIN = 1;
const LINE_WIDTH_MAX = 10;
const LINE_WIDTH_SIZE: TLDefaultSizeStyle = "xl";
const LINE_WIDTH_SHAPE_TYPES = new Set(["arrow", "draw", "geo", "line"]);

type ArrowKind = "arc" | "elbow";
type StrokeWidthShape = TLShape & {
  props: {
    size: TLDefaultSizeStyle;
    scale: number;
  };
};

const ARROW_KIND_ITEMS: ReadonlyArray<{ value: ArrowKind; icon: TLUiIconType }> = [
  { value: "arc", icon: "arrow-arc" },
  { value: "elbow", icon: "arrow-elbow" },
];

export function LineWidthStylePanel(props: TLUiStylePanelProps) {
  const styles = useRelevantStyles();

  return (
    <DefaultStylePanel {...props}>
      <LineWidthStylePanelContent styles={styles} />
    </DefaultStylePanel>
  );
}

function LineWidthStylePanelContent({ styles }: { styles: ReadonlySharedStyleMap | null }) {
  const isDarkMode = useIsDarkMode();

  if (!styles) return null;

  const geo = styles.get(GeoShapeGeoStyle);
  const arrowheadEnd = styles.get(ArrowShapeArrowheadEndStyle);
  const arrowheadStart = styles.get(ArrowShapeArrowheadStartStyle);
  const arrowKind = styles.get(ArrowShapeKindStyle);
  const spline = styles.get(LineShapeSplineStyle);
  const font = styles.get(DefaultFontStyle);

  const hideGeo = geo === undefined;
  const hideArrowHeads = arrowheadEnd === undefined && arrowheadStart === undefined;
  const hideSpline = spline === undefined;
  const hideArrowKind = arrowKind === undefined;
  const hideText = font === undefined;
  const theme = getDefaultColorTheme({ isDarkMode });

  return (
    <>
      <CommonStylePickerSet theme={theme} styles={styles} />
      {!hideText && <TextStylePickerSet theme={theme} styles={styles} />}
      {!(hideGeo && hideArrowHeads && hideSpline && hideArrowKind) && (
        <div className="tlui-style-panel__section">
          <GeoStylePickerSet styles={styles} />
          <ArrowKindPickerSet styles={styles} />
          <LineWidthSlider />
          <ArrowheadStylePickerSet styles={styles} />
          <SplineStylePickerSet styles={styles} />
        </div>
      )}
    </>
  );
}

function ArrowKindPickerSet({ styles }: { styles: ReadonlySharedStyleMap }) {
  const editor = useEditor();
  const msg = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const arrowKind = styles.get(ArrowShapeKindStyle) as SharedStyle<ArrowKind> | undefined;

  const handleArrowKindChange = useCallback(
    (value: ArrowKind) => {
      editor.markHistoryStoppingPoint("select arrow kind");
      editor.run(() => {
        if (editor.isIn("select")) {
          editor.setStyleForSelectedShapes(ArrowShapeKindStyle, value);
        }
        editor.setStyleForNextShapes(ArrowShapeKindStyle, value);
        editor.updateInstanceState({ isChangingStyle: true });
      });
    },
    [editor],
  );

  if (arrowKind === undefined) return null;

  const selectedIcon =
    arrowKind.type === "shared" ? ARROW_KIND_ITEMS.find((item) => item.value === arrowKind.value)?.icon : undefined;
  const stylePanelName = msg("style-panel.arrow-kind");
  const title =
    arrowKind.type === "mixed"
      ? msg("style-panel.mixed")
      : `${stylePanelName} - ${msg(`arrow-kind-style.${arrowKind.value}`)}`;
  const popoverId = "style panel arrow-kind";

  return (
    <TldrawUiToolbar label={stylePanelName}>
      <TldrawUiPopover id={popoverId} open={isOpen} onOpenChange={setIsOpen}>
        <TldrawUiPopoverTrigger>
          <TldrawUiToolbarButton type="menu" data-testid="style.arrow-kind" data-direction="left" title={title}>
            <TldrawUiButtonLabel>{stylePanelName}</TldrawUiButtonLabel>
            <TldrawUiButtonIcon icon={selectedIcon ?? "mixed"} />
          </TldrawUiToolbarButton>
        </TldrawUiPopoverTrigger>
        <TldrawUiPopoverContent side="left" align="center">
          <TldrawUiToolbar label={stylePanelName} className="tlui-buttons__grid tlui-buttons__arrow-kind">
            <TldrawUiMenuContextProvider type="icons" sourceId="style-panel">
              {ARROW_KIND_ITEMS.map((item) => {
                const label = `${stylePanelName} - ${msg(`arrow-kind-style.${item.value}`)}`;

                return (
                  <TldrawUiToolbarButton
                    key={item.value}
                    type="icon"
                    data-testid={`style.arrow-kind.${item.value}`}
                    title={label}
                    isActive={selectedIcon === item.icon}
                    onClick={() => {
                      handleArrowKindChange(item.value);
                      tlmenus.deleteOpenMenu(popoverId, editor.contextId);
                      setIsOpen(false);
                    }}
                  >
                    <TldrawUiButtonIcon icon={item.icon} />
                  </TldrawUiToolbarButton>
                );
              })}
            </TldrawUiMenuContextProvider>
          </TldrawUiToolbar>
        </TldrawUiPopoverContent>
      </TldrawUiPopover>
    </TldrawUiToolbar>
  );
}

function LineWidthSlider() {
  const editor = useEditor();

  const widthInfo = useValue(
    "selected line width",
    () => {
      const strokeShapes = getSelectedStrokeWidthShapes(editor);
      if (strokeShapes.length === 0) {
        return { hasShapes: false, isMixed: false, value: LINE_WIDTH_MAX };
      }

      const widths = strokeShapes.map(getStrokeWidthForShape);
      const firstWidth = widths[0];
      const isMixed = widths.some((width) => width !== firstWidth);

      return {
        hasShapes: true,
        isMixed,
        value: isMixed ? LINE_WIDTH_MAX : firstWidth,
      };
    },
    [editor],
  );

  const handleHistoryMark = useCallback((id: string) => editor.markHistoryStoppingPoint(id), [editor]);

  const handleLineWidthChange = useCallback(
    (value: number) => {
      const width = clampLineWidth(value);
      const strokeShapes = getSelectedStrokeWidthShapes(editor);
      if (strokeShapes.length === 0) return;

      const updates = strokeShapes.map((shape) => ({
        id: shape.id,
        type: shape.type,
        props: {
          size: LINE_WIDTH_SIZE,
          scale: getScaleForLineWidth(shape, width),
        },
      })) as TLShapePartial[];

      editor.run(() => {
        editor.updateShapes(updates);
        editor.setStyleForNextShapes(DefaultSizeStyle, LINE_WIDTH_SIZE);
        editor.updateInstanceState({ isChangingStyle: true });
      });

      kickoutOccludedShapes(
        editor,
        strokeShapes.map((shape) => shape.id),
      );
    },
    [editor],
  );

  if (!widthInfo.hasShapes) return null;

  return (
    <TldrawUiSlider
      data-testid="style.line-width"
      min={LINE_WIDTH_MIN}
      steps={LINE_WIDTH_MAX}
      value={widthInfo.value}
      label={widthInfo.isMixed ? "style-panel.mixed" : "style-panel.size"}
      title={`Line width ${widthInfo.value}px`}
      onValueChange={handleLineWidthChange}
      onHistoryMark={handleHistoryMark}
    />
  );
}

function getSelectedStrokeWidthShapes(editor: ReturnType<typeof useEditor>) {
  const selectedShapes = editor.getSelectedShapes();
  const strokeShapes: StrokeWidthShape[] = [];

  function addShape(shape: TLShape | undefined) {
    if (!shape) return;

    if (shape.type === "group") {
      for (const childId of editor.getSortedChildIdsForParent(shape.id)) {
        addShape(editor.getShape(childId));
      }
      return;
    }

    if (isStrokeWidthShape(shape)) {
      strokeShapes.push(shape);
    }
  }

  for (const shape of selectedShapes) {
    addShape(shape);
  }

  return strokeShapes;
}

function isStrokeWidthShape(shape: TLShape): shape is StrokeWidthShape {
  return LINE_WIDTH_SHAPE_TYPES.has(shape.type) && "size" in shape.props && "scale" in shape.props;
}

function getStrokeWidthForShape(shape: StrokeWidthShape) {
  const baseWidth = getBaseStrokeWidthForShape(shape);
  return clampLineWidth(Math.round(baseWidth * shape.props.scale));
}

function getBaseStrokeWidthForShape(shape: StrokeWidthShape) {
  const baseWidth = STROKE_SIZES[shape.props.size];
  return shape.type === "draw" ? baseWidth + 1 : baseWidth;
}

function getScaleForLineWidth(shape: StrokeWidthShape, width: number) {
  return width / getBaseStrokeWidthForShape({ ...shape, props: { ...shape.props, size: LINE_WIDTH_SIZE } });
}

function clampLineWidth(value: number) {
  return Math.max(LINE_WIDTH_MIN, Math.min(LINE_WIDTH_MAX, Math.round(value)));
}
