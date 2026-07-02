import {
  NoteShapeUtil,
  StateNode,
  createShapeId,
  maybeSnapToGrid,
  type TLHandle,
  type TLNoteShape,
  type TLPointerEventInfo,
  type TLShapeId,
  Vec,
} from "tldraw";
import { createShapePropsMigrationSequence } from "@tldraw/tlschema";

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
  shape = {} as TLNoteShape;

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

export class ScalableNoteShapeTool extends StateNode {
  static override id = "scalable-note";
  static override initial = "idle";

  static override children() {
    return [Idle, Pointing];
  }

  override shapeType = "scalable-note";
}

export class ScalableNoteShapeUtil extends NoteShapeUtil {
  static override type = "scalable-note" as "note";
  static override migrations = createShapePropsMigrationSequence({
    sequence: [],
  });

  override options = {
    resizeMode: "scale" as const,
  };

  override getHandles(): TLHandle[] {
    return [];
  }
}

function createScalableNoteShape(editor: StateNode["editor"], id: TLShapeId, center: Vec) {
  editor.createShape({
    id,
    type: "scalable-note",
    x: center.x,
    y: center.y,
    props: {
      scale: editor.user.getIsDynamicResizeMode() ? 1 / editor.getZoomLevel() : 1,
    },
  });

  const shape = editor.getShape<TLNoteShape>(id);
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

  return editor.getShape<TLNoteShape>(id);
}
