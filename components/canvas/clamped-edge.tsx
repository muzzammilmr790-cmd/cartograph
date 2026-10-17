import React from "react";
import { BaseEdge, EdgeProps, getBezierPath, useInternalNode } from "@xyflow/react";

export const ClampedEdge = React.memo(function ClampedEdge(props: EdgeProps) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
  } = props;

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  let clampedSourceY = sourceY;
  let clampedTargetY = targetY;

  if (sourceNode && (sourceNode.data as any)?.isOpen && sourceNode.internals?.positionAbsolute) {
    const top = sourceNode.internals.positionAbsolute.y;
    const height = sourceNode.measured?.height ?? (sourceNode.style?.height as number) ?? 320;
    const minY = top + 40 + 14;
    const maxY = top + height - 14;
    clampedSourceY = Math.max(minY, Math.min(maxY, sourceY));
  }

  if (targetNode && (targetNode.data as any)?.isOpen && targetNode.internals?.positionAbsolute) {
    const top = targetNode.internals.positionAbsolute.y;
    const height = targetNode.measured?.height ?? (targetNode.style?.height as number) ?? 320;
    const minY = top + 40 + 14;
    const maxY = top + height - 14;
    clampedTargetY = Math.max(minY, Math.min(maxY, targetY));
  }

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY: clampedSourceY,
    sourcePosition,
    targetX,
    targetY: clampedTargetY,
    targetPosition,
  });

  return <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />;
});

