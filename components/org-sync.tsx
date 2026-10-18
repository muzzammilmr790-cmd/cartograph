"use client";

import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface OrgSyncProps {
  orgId: string;
  needsActiveSet: boolean;
}

export function OrgSync({ orgId, needsActiveSet }: OrgSyncProps) {
  const { setActive } = useClerk();
  const router = useRouter();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (needsActiveSet && setActive && !hasTriggered.current) {
      hasTriggered.current = true;
      setActive({ organization: orgId })
        .then(() => {
          router.refresh();
        })
        .catch((err) => {
          console.error("[OrgSync] Error setting active organization:", err);
          hasTriggered.current = false;
        });
    }
  }, [orgId, needsActiveSet, setActive, router]);

  return null;
}
