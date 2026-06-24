"use client";

import { Suspense } from "react";
import { FollowsContent } from "./content";

export default {
  EmptyFollowing: (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="p-4">
        <FollowsContent />
      </div>
    </Suspense>
  ),
  MobilePressure: (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="w-80 p-3">
        <FollowsContent />
      </div>
    </Suspense>
  ),
};
