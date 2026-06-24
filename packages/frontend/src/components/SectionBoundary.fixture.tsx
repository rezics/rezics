"use client";

import React from "react";
import { SectionBoundary } from "./SectionBoundary";

function SuspendForever(): React.ReactNode {
  throw new Promise<never>(() => {});
}

function ThrowError(): React.ReactNode {
  throw new Error("Something went wrong — demo error for fixture");
}

export default {
  WithContent: (
    <SectionBoundary>
      <div className="p-4">
        <p className="text-sm">This content rendered immediately without suspending.</p>
      </div>
    </SectionBoundary>
  ),
  Loading: (
    <SectionBoundary>
      <SuspendForever />
    </SectionBoundary>
  ),
  Error: (
    <SectionBoundary>
      <ThrowError />
    </SectionBoundary>
  ),
};
