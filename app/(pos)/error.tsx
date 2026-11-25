"use client";

import { RouteError } from "@/components/route-error";

export default function Error(props: { error: unknown; retry: () => void }) {
  return (
    <div className="px-4 py-6 sm:px-6">
      <RouteError {...props} />
    </div>
  );
}
