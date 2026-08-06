import { useCallback, useEffect, useRef, useState } from "react";
import { parseUrlState, serializeUrlState } from "../domain/urlState.js";

export function useUrlState(initialState) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(initialState);

  useEffect(() => {
    const canonicalSearch = serializeUrlState(stateRef.current);
    if (window.location.search !== canonicalSearch) {
      window.history.replaceState(null, "", canonicalSearch);
    }
  }, []);

  useEffect(() => {
    const restore = () => {
      const restored = parseUrlState(window.location.search);
      stateRef.current = restored;
      setState(restored);
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
