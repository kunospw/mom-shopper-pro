import { useCallback } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
export function useUnsavedChanges(dirty: boolean, allowWithin?: string) {
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [dirty],
    ),
  );
  return useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty) return false;
    if (
      allowWithin &&
      currentLocation.pathname.startsWith(`${allowWithin}/`) &&
      nextLocation.pathname.startsWith(`${allowWithin}/`)
    )
      return false;
    return (
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search
    );
  });
}
