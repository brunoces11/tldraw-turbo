/* eslint-disable react-hooks/rules-of-hooks */
import {
  Box,
  EMPTY_ARRAY,
  FONT_FAMILIES,
  Group2d,
  LABEL_FONT_SIZES,
  NoteShapeTool,
  Rectangle2d,
  RichTextLabel,
  RichTextSVG,
  ShapeUtil,
  SvgExportContext,
  TEXT_PROPS,
  T,
  TLBaseShape,
  TLHandle,
  TLNoteShapeProps,
  TLResizeInfo,
  TLShape,
  TLShapeId,
  Vec,
  WeakCache,
  createShapeId,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  getDefaultColorTheme,
  getFontsFromRichText,
  isEqual,
  lerp,
  maybeSnapToGrid,
  noteShapeProps,
  renderHtmlFromRichTextForMeasurement,
  renderPlaintextFromRichText,
  resizeBox,
  rng,
  toDomPrecision,
  toRichText,
  useValue,
  type TLPointerEventInfo,
  type TLStateNodeConstructor,
} from "tldraw";
import { StateNode } from "@tldraw/editor";

const NOTE_SIZE = 200;
const NOTE_MIN_SIZE = 80;
const LABEL_PADDING = 16;

type TLScalableNoteShapeProps = TLNoteShapeProps & {
  w: number;
  h: number;
};

type TLScalableNoteShape = TLBaseShape<"scalable-note", TLScalableNoteShapeProps>;

const scalableNoteShapeProps = {
  ...noteShapeProps,
  w: T.positiveNumber,
  h: T.positiveNumber,
};

const scalableNoteVersions = createShapePropsMigrationIds("scalable-note", {
  AddDimensions: 1,
});

const scalableNoteMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: scalableNoteVersions.AddDimensions,
      up: (props) => {
        const scale = typeof props.scale === "number" ? props.scale : 1;
        const growY = typeof props.growY === "number" ? props.growY : 0;
        props.w = NOTE_SIZE * scale;
        props.h = (NOTE_SIZE + growY) * scale;
        props.scale = 1;
        props.growY = 0;
      },
      down: "retired",
    },
  ],
});

class Idle extends StateNode {
  static override id = "idle";

  override onEnter() {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onPointerDown(info: TLPointerEventInfo) {
    this.parent.transition("pointing", info);
  }

  override onCancel() {
    this.editor.setCurrentTool("select");
  }
}

class Pointing extends StateNode {
  static override id = "pointing";

  info = {} as TLPointerEventInfo;
  markId = "";
  shape = {} as TLScalableNoteShape;

  override onEnter(info: TLPointerEventInfo) {
    this.info = info;

    const id = createShapeId();
    this.markId = this.editor.markHistoryStoppingPoint(`creating_scalable_note:${id}`);
    const shape = createScalableNoteShape(this.editor, id, this.editor.inputs.originPagePoint.clone());

    if (shape) {
      this.shape = shape;
    } else {
      this.cancel();
    }
  }

  override onPointerMove(info: TLPointerEventInfo) {
    if (!this.editor.inputs.isDragging) return;

    this.editor.setCurrentTool("select.translating", {
      ...info,
      target: "shape",
      shape: this.shape,
      onInteractionEnd: "select",
      isCreating: true,
      creatingMarkId: this.markId,
      onCreate: () => {
        this.editor.setEditingShape(this.shape.id);
        this.editor.setCurrentTool("select.editing_shape");
      },
    });
  }

  override onPointerUp() {
    this.complete();
  }

  override onComplete() {
    this.complete();
  }

  override onCancel() {
    this.cancel();
  }

  override onInterrupt() {
    this.cancel();
  }

  private complete() {
    if (this.editor.getInstanceState().isToolLocked) {
      this.parent.transition("idle");
      return;
    }

    this.editor.setEditingShape(this.shape.id);
    this.editor.setCurrentTool("select.editing_shape", {
      ...this.info,
      target: "shape",
      shape: this.shape,
    });
  }

  private cancel() {
    this.editor.bailToMark(this.markId);
    this.parent.transition("idle", this.info);
  }
}

export class ScalableNoteShapeTool extends NoteShapeTool {
  static override id = "scalable-note";
  static override initial = "idle";

  static override children(): TLStateNodeConstructor[] {
    return [Idle, Pointing];
  }

  override shapeType = "scalable-note";
}

export class ScalableNoteShapeUtil extends ShapeUtil<TLScalableNoteShape> {
  static override type = "scalable-note" as const;
  static override props = scalableNoteShapeProps;
  static override migrations = scalableNoteMigrations;

  override canEdit() {
    return true;
  }

  override hideResizeHandles() {
    return false;
  }

  override isAspectRatioLocked() {
    return false;
  }

  override hideSelectionBoundsFg() {
    return false;
  }

  getDefaultProps(): TLScalableNoteShape["props"] {
    return {
      color: "black",
      richText: toRichText(""),
      size: "m",
      font: "draw",
      align: "middle",
      verticalAlign: "middle",
      labelColor: "black",
      growY: 0,
      fontSizeAdjustment: 0,
      url: "",
      scale: 1,
      w: NOTE_SIZE,
      h: NOTE_SIZE,
    };
  }

  getGeometry(shape: TLScalableNoteShape) {
    const { labelHeight, labelWidth } = getLabelSize(this.editor, shape);
    const { w, h } = shape.props;

    return new Group2d({
      children: [
        new Rectangle2d({ width: w, height: h, isFilled: true }),
        new Rectangle2d({
          x:
            shape.props.align === "start"
              ? 0
              : shape.props.align === "end"
                ? w - labelWidth
                : (w - labelWidth) / 2,
          y:
            shape.props.verticalAlign === "start"
              ? 0
              : shape.props.verticalAlign === "end"
                ? h - labelHeight
                : (h - labelHeight) / 2,
          width: labelWidth,
          height: labelHeight,
          isFilled: true,
          isLabel: true,
        }),
      ],
    });
  }

  override getHandles(): TLHandle[] {
    return [];
  }

  override onResize(shape: TLScalableNoteShape, info: TLResizeInfo<TLScalableNoteShape>) {
    return resizeBox(shape as never, info as never, {
      minWidth: NOTE_MIN_SIZE,
      minHeight: NOTE_MIN_SIZE,
    }) as TLScalableNoteShape;
  }

  override getText(shape: TLScalableNoteShape) {
    return renderPlaintextFromRichText(this.editor, shape.props.richText);
  }

  override getFontFaces(shape: TLScalableNoteShape) {
    if (isEmptyRichTextValue(shape.props.richText)) {
      return EMPTY_ARRAY;
    }

    return getFontsFromRichText(this.editor, shape.props.richText, {
      family: `tldraw_${shape.props.font}`,
      weight: "normal",
      style: "normal",
    });
  }

  component(shape: TLScalableNoteShape) {
    const {
      id,
      type,
      props: { labelColor, color, font, size, align, richText, verticalAlign, fontSizeAdjustment, w, h },
    } = shape;

    const theme = getDefaultColorTheme({ isDarkMode: this.editor.user.getIsDarkMode() });
    const isSelected = shape.id === this.editor.getOnlySelectedShapeId();
    const shadowScale = Math.max(0.5, Math.min(w, h) / NOTE_SIZE);
    const hideShadows = useValue("zoom", () => this.editor.getZoomLevel() < 0.35 / shadowScale, [
      shadowScale,
      this.editor,
    ]);
    const rotation = useValue(
      "shape rotation",
      () => this.editor.getShapePageTransform(id)?.rotation() ?? 0,
      [this.editor]
    );

    return (
      <div
        id={id}
        className="tl-note__container"
        style={{
          width: w,
          height: h,
          backgroundColor: theme[color].note.fill,
          borderBottom: hideShadows ? `${2 * shadowScale}px solid rgb(144, 144, 144)` : "none",
          boxShadow: hideShadows ? "none" : getNoteShadow(shape.id, rotation, shadowScale),
        }}
      >
        {(isSelected || !isEmptyRichTextValue(richText)) && (
          <RichTextLabel
            shapeId={id}
            type={type}
            font={font}
            fontSize={fontSizeAdjustment || LABEL_FONT_SIZES[size]}
            lineHeight={TEXT_PROPS.lineHeight}
            align={align}
            verticalAlign={verticalAlign}
            richText={richText}
            isSelected={isSelected}
            labelColor={labelColor === "black" ? theme[color].note.text : theme[labelColor].fill}
            wrap
            padding={LABEL_PADDING}
          />
        )}
      </div>
    );
  }

  indicator(shape: TLScalableNoteShape) {
    return <rect rx={1} width={toDomPrecision(shape.props.w)} height={toDomPrecision(shape.props.h)} />;
  }

  override toSvg(shape: TLScalableNoteShape, ctx: SvgExportContext) {
    const theme = getDefaultColorTheme({ isDarkMode: ctx.isDarkMode });
    const bounds = new Box(0, 0, shape.props.w, shape.props.h);

    return (
      <>
        <rect x={5} y={5} rx={1} width={Math.max(0, bounds.w - 10)} height={bounds.h} fill="rgba(0,0,0,.1)" />
        <rect rx={1} width={bounds.w} height={bounds.h} fill={theme[shape.props.color].note.fill} />
        <RichTextSVG
          fontSize={shape.props.fontSizeAdjustment || LABEL_FONT_SIZES[shape.props.size]}
          font={shape.props.font}
          align={shape.props.align}
          verticalAlign={shape.props.verticalAlign}
          richText={shape.props.richText}
          labelColor={theme[shape.props.color].note.text}
          bounds={bounds}
          padding={LABEL_PADDING}
          showTextOutline={false}
        />
      </>
    );
  }

  override onBeforeCreate(next: TLScalableNoteShape) {
    return getScalableNoteSizeAdjustments(this.editor, next);
  }

  override onBeforeUpdate(prev: TLScalableNoteShape, next: TLScalableNoteShape) {
    if (
      isEqual(prev.props.richText, next.props.richText) &&
      prev.props.font === next.props.font &&
      prev.props.size === next.props.size &&
      prev.props.w === next.props.w &&
      prev.props.h === next.props.h
    ) {
      return;
    }

    return getScalableNoteSizeAdjustments(this.editor, next);
  }

  override getInterpolatedProps(
    startShape: TLScalableNoteShape,
    endShape: TLScalableNoteShape,
    t: number
  ): TLScalableNoteShape["props"] {
    return {
      ...(t > 0.5 ? endShape.props : startShape.props),
      w: lerp(startShape.props.w, endShape.props.w, t),
      h: lerp(startShape.props.h, endShape.props.h, t),
    };
  }
}

function createScalableNoteShape(editor: StateNode["editor"], id: TLShapeId, center: Vec) {
  editor.createShape({
    id,
    type: "scalable-note",
    x: center.x,
    y: center.y,
    props: {
      scale: 1,
      w: NOTE_SIZE,
      h: NOTE_SIZE,
    },
  });

  const shape = editor.getShape<TLScalableNoteShape>(id);
  if (!shape) return;

  editor.select(id);
  const bounds = editor.getShapeGeometry(shape).bounds;
  const newPoint = maybeSnapToGrid(new Vec(shape.x - bounds.width / 2, shape.y - bounds.height / 2), editor);

  editor.updateShape({
    id,
    type: "scalable-note",
    x: newPoint.x,
    y: newPoint.y,
  });

  return editor.getShape<TLScalableNoteShape>(id);
}

function getScalableNoteSizeAdjustments(editor: ShapeUtil["editor"], shape: TLScalableNoteShape) {
  const { labelHeight, fontSizeAdjustment } = getLabelSize(editor, shape);
  const minHeight = Math.max(NOTE_MIN_SIZE, labelHeight);

  if (shape.props.h !== minHeight && shape.props.h < minHeight) {
    return {
      ...shape,
      props: {
        ...shape.props,
        h: minHeight,
        fontSizeAdjustment,
        growY: 0,
        scale: 1,
      },
    };
  }

  if (fontSizeAdjustment !== shape.props.fontSizeAdjustment || shape.props.growY !== 0 || shape.props.scale !== 1) {
    return {
      ...shape,
      props: {
        ...shape.props,
        fontSizeAdjustment,
        growY: 0,
        scale: 1,
      },
    };
  }
}

function getScalableNoteLabelSize(editor: ShapeUtil["editor"], shape: TLScalableNoteShape) {
  const { richText, font, size, w } = shape.props;

  if (isEmptyRichTextValue(richText)) {
    const minHeight = LABEL_FONT_SIZES[size] * TEXT_PROPS.lineHeight + LABEL_PADDING * 2;
    return { labelHeight: minHeight, labelWidth: 100, fontSizeAdjustment: 0 };
  }

  const unadjustedFontSize = LABEL_FONT_SIZES[size];
  const availableWidth = Math.max(NOTE_MIN_SIZE, w) - LABEL_PADDING * 2 - 1;

  let fontSizeAdjustment = 0;
  let iterations = 0;
  let labelHeight = NOTE_SIZE;
  let labelWidth = NOTE_SIZE;

  do {
    fontSizeAdjustment = Math.min(unadjustedFontSize, unadjustedFontSize - iterations);
    const html = renderHtmlFromRichTextForMeasurement(editor, richText);
    const nextTextSize = editor.textMeasure.measureHtml(html, {
      ...TEXT_PROPS,
      fontFamily: FONT_FAMILIES[font],
      fontSize: fontSizeAdjustment,
      maxWidth: availableWidth,
      disableOverflowWrapBreaking: true,
      measureScrollWidth: true,
    });

    labelHeight = nextTextSize.h + LABEL_PADDING * 2;
    labelWidth = Math.min(Math.max(nextTextSize.w + LABEL_PADDING * 2, 100), Math.max(NOTE_MIN_SIZE, w));

    if (fontSizeAdjustment <= 14) {
      const htmlWithOverflowBreak = renderHtmlFromRichTextForMeasurement(editor, richText);
      const overflowSafeTextSize = editor.textMeasure.measureHtml(htmlWithOverflowBreak, {
        ...TEXT_PROPS,
        fontFamily: FONT_FAMILIES[font],
        fontSize: fontSizeAdjustment,
        maxWidth: availableWidth,
      });
      labelHeight = overflowSafeTextSize.h + LABEL_PADDING * 2;
      labelWidth = Math.min(
        Math.max(overflowSafeTextSize.w + LABEL_PADDING * 2, 100),
        Math.max(NOTE_MIN_SIZE, w)
      );
      break;
    }

    if (nextTextSize.scrollWidth.toFixed(0) === nextTextSize.w.toFixed(0)) {
      break;
    }
  } while (iterations++ < 50);

  return {
    labelHeight,
    labelWidth,
    fontSizeAdjustment,
  };
}

function isEmptyRichTextValue(richText: TLScalableNoteShape["props"]["richText"]) {
  return richText.content.length === 1 && !(richText.content[0] as { content?: unknown }).content;
}

const labelSizesForNote = new WeakCache<TLShape, ReturnType<typeof getScalableNoteLabelSize>>();

function getLabelSize(editor: ShapeUtil["editor"], shape: TLScalableNoteShape) {
  return labelSizesForNote.get(shape, () => getScalableNoteLabelSize(editor, shape));
}

function getNoteShadow(id: string, rotation: number, scale: number) {
  const random = rng(id);
  const lift = Math.abs(random()) + 0.5;
  const oy = Math.cos(rotation);
  const a = 5 * scale;
  const b = 4 * scale;
  const c = 6 * scale;
  const d = 7 * scale;
  return `0px ${a - lift}px ${a}px -${a}px rgba(15, 23, 31, .6),
  0px ${(b + lift * d) * Math.max(0, oy)}px ${c + lift * d}px -${b + lift * c}px rgba(15, 23, 31, ${(0.3 + lift * 0.1).toFixed(2)}), 
  0px ${48 * scale}px ${10 * scale}px -${10 * scale}px inset rgba(15, 23, 44, ${((0.022 + random() * 0.005) * ((1 + oy) / 2)).toFixed(2)})`;
}
