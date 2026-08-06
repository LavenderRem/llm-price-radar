import { useCallback, useEffect, useRef, useState } from "react";
import { parseUrlState, serializeUrlState } from "../domain/urlState.js";

export function useUrlState(initialState, restoreState) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);
  const restoreStateRef = useRef(restoreState);
  restoreStateRef.current = restoreState;

  useEffect(() => {
    const canonicalSearch = serializeUrlState(stateRef.current);
    if (window.location.search !== canonicalSearch) {
      window.history.replaceState(null, "", canonicalSearch);
    }
  }, []);

  useEffect(() => {
    const restore = () => {
      const parsed = parseUrlState(window.location.search);
      const result = restoreStateRef.current?.(parsed);
      const restored = result?.state ?? parsed;
      stateRef.current = restored;
      setState(restored);
      if (result?.changed) {
        const cleanedSearch = serializeUrlState(restored);
        if (window.location.search !== cleanedSearch) {
          window.history.replaceState(null, "", cleanedSearch);
        }
      }
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const updateState = useCallback((update, options = {}) => {
    const current = stateRef.current;
    const next = typeof update === "function" ? update(current) : update;
    const search = serializeUrlState(next);
    const method = options.history === "replace" ? "replaceState" : "pushState";

    stateRef.current = next;
    setState(next);
    if (window.location.search !== search) {
      window.history[method](null, "", search);
    }
  }, []);

  return [state, updateState];
}
