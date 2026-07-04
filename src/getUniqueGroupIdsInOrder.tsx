import { Editor } from "tldraw";

export function getUniqueGroupIdsInOrder(editor: Editor) {
  const shapes = editor.getCurrentPageShapes();
  const groupIds = shapes.map((shape) => shape.meta.groupId as number);
  const uniqueGroupIdsInOrder = [...new Set(groupIds)].sort((a, b) => a - b);
  return uniqueGroupIdsInOrder;
}

export function getMaxPresentationGroupId(editor: Editor) {
  return editor.getCurrentPageShapes().reduce((maxGroupId, shape) => {
    const groupId = Number(shape.meta.groupId);
    return Number.isFinite(groupId) && groupId > maxGroupId ? groupId : maxGroupId;
  }, 0);
}
