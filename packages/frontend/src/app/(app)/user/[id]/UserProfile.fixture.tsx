"use client";
import { Suspense } from "react";
import { UserProfileContent } from "./content";

export default {
  Default: (
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfileContent paramsPromise={Promise.resolve({ id: "user-alice" })} />
    </Suspense>
  ),
};
