import { useParams } from "@tanstack/react-router";
import type React from "react";
import { BookReadNodeSection } from "./BookReadNodeSection";

export const BookReadNodePage: React.FC = () => {
  const { bookId, nodeId } = useParams({
    from: "/book_/$bookId/node/$nodeId/",
  });
  return <BookReadNodeSection bookId={bookId} nodeId={nodeId} />;
};
