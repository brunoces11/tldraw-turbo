import { stopEventPropagation, useEditor, useValue } from "tldraw";
import { ChangeGroupId } from "./ChangeGroupId.tsx";

export function InFrontOfTheCanvas() {
  const editor = useEditor();

  const selectionInfo = useValue(
    "selection bounds",
    () => {
      const screenBounds = editor.getViewportScreenBounds();
      const rotation = editor.getSelectionRotation();
      const rotatedScreenBounds = editor.getSelectionRotatedScreenBounds();
      const onlySelectedShape = editor.getOnlySelectedShape();
      if (!rotatedScreenBounds) return;
      return {
        x: rotatedScreenBounds.x - screenBounds.x,
        y: rotatedScreenBounds.y - screenBounds.y,
        width: rotatedScreenBounds.width,
        height: rotatedScreenBounds.height,
        rotation: rotation,
        isImage: onlySelectedShape?.type === "image",
      };
    },
    [editor],
  );

  const latestShapeMarkerInfo = useValue(
    "latest presentation shape marker",
    () => {
      const shapes = editor.getCurrentPageShapes();
      const latestShape = shapes.reduce<(typeof shapes)[number] | null>((latest, shape) => {
        const groupId = Number(shape.meta.groupId);
        if (!Number.isFinite(groupId) || groupId <= 0) {
          return latest;
        }

        const latestGroupId = latest ? Number(latest.meta.groupId) : 0;
        return groupId > latestGroupId ? shape : latest;
      }, null);

      if (!latestShape) {
        return null;
      }

      const pageBounds = editor.getShapePageBounds(latestShape);
      if (!pageBounds) {
        return null;
      }

      const screenBounds = editor.getViewportScreenBounds();
      const screenPoint = editor.pageToScreen({ x: pageBounds.x, y: pageBounds.y });

      return {
        x: screenPoint.x - screenBounds.x,
        y: screenPoint.y - screenBounds.y,
      };
    },
    [editor],
  );

  if (!selectionInfo && !latestShapeMarkerInfo) {
    return null;
  }

  return (
    <>
      {latestShapeMarkerInfo && (
        <div
          aria-label="Latest presentation object"
          data-testid="latest-presentation-shape-marker"
          style={{
            backgroundColor: "#ef4444",
            border: "2px solid #ffffff",
            borderRadius: "999px",
            boxShadow: "0 1px 4px rgba(15, 23, 42, 0.35)",
            height: "12px",
            left: `${latestShapeMarkerInfo.x - 6}px`,
            pointerEvents: "none",
            position: "absolute",
            top: `${latestShapeMarkerInfo.y - 6}px`,
            width: "12px",
            zIndex: 200,
          }}
        />
      )}
      {selectionInfo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transformOrigin: "top left",
            transform: `translate(${selectionInfo.x}px, ${selectionInfo.y}px) rotate(${selectionInfo.rotation}rad)`,
            pointerEvents: "all",
          }}
          onPointerDown={stopEventPropagation}
        >
          <div
            style={{
              position: "absolute",
              display: "flex",
              gap: "4px",
              pointerEvents: "all",
              transform: `translate(${selectionInfo.width / 2 - 32 + (selectionInfo.isImage ? 76 : 0)}px, ${-40}px)`,
            }}
            onPointerDown={stopEventPropagation}
          >
            <ChangeGroupId />
          </div>
        </div>
      )}
    </>
  );
}
