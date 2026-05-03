import { postQueries } from "@rezics/api/post/post";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { PostCard } from "../components/item/PostCard";
import { PostTreeSection } from "../sections/PostTreeSection";

export const ContinueThreadPage: React.FC = () => {
  const { rootPostUnitId, unitId } = useParams({ strict: false }) as {
    rootPostUnitId: string;
    unitId: string;
  };
  const { data: anchor } = useQuery(postQueries.detail(unitId));

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-4">
      <div className="mb-4">
        <Link to="/post/$rootPostUnitId" params={{ rootPostUnitId }}>
          <span className="text-xs text-rezics-color-primary">
            ← Back to original thread
          </span>
        </Link>
      </div>
      {anchor && <PostCard post={anchor} />}
      <PostTreeSection rootPostUnitId={unitId} />
    </div>
  );
};

export default ContinueThreadPage;
