import { useContext } from "react";
import { AppContext } from "./app-context";

export function useAppContext() {
  return useContext(AppContext);
}
