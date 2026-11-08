// Settings panels stay mounted while hidden. ResizeObserver reports zero for
// hidden rows; caching that zero collapses the virtualized catalog on return.
export function modelRowHeight(
  element: Pick<Element, "getBoundingClientRect">,
  estimate: number
): number {
  const height = element.getBoundingClientRect().height;
  return height > 0 ? height : estimate;
}
