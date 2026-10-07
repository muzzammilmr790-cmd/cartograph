"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

interface OrgSyncProps {
  orgId: string;
  needsActiveSet: boolean;
}

export function OrgSync({ orgId, needsActiveSet }: OrgSyncProps) {
  const { setActive } = useClerk();

  useEffect(() => {
    if (needsActiveSet && setActive) {
      setActive({ organization: orgId }).catch(() => {
        // Ignore set active errors
      });
    }
  }, [orgId, needsActiveSet, setActive]);

  return null;
}
