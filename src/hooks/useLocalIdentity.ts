import { useCallback, useState } from "react";
import {
  getDisplayName,
  getMemberId,
  setDisplayName as persistName,
} from "@/lib/identity";

/** Stable browser identity: a memberId plus an editable display name. */
export function useLocalIdentity() {
  const [memberId] = useState(getMemberId);
  const [displayName, setName] = useState(getDisplayName);

  const setDisplayName = useCallback((name: string) => {
    const trimmed = name.trim();
    persistName(trimmed);
    setName(trimmed);
  }, []);

  return { memberId, displayName, setDisplayName };
}
