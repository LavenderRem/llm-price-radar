import { useEffect, useState } from "react";
import { parseUrlState, serializeUrlState } from "../domain/urlState.js";

export function useUrlState(initialState) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    window.history.replaceState(null, "", serializeUrlState(state));
  }, [state]);

  useEffect(() => {
    const restore = () => setState(parseUrlState(window.location.search));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  return [state, setState];
}
