"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { use } from "react";

export function PollDetailContent({
  paramsPromise,
}: {
  readonly paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Poll Question</h1>
        <p className="text-muted-foreground text-sm">
          Poll {id} — details will load once API is connected.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          {["Option A", "Option B", "Option C"].map((option, i) => (
            <div className="space-y-1" key={option}>
              <div className="flex items-center justify-between text-sm">
                <span>{option}</span>
                <span className="text-muted-foreground">{[42, 31, 27][i]}%</span>
              </div>
              <Progress value={[42, 31, 27][i]} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">0 votes</span>
        <Button size="sm">Vote</Button>
      </div>
    </div>
  );
}
