import { shelfDetailQuery } from "@rezics/api/shelf";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { titleMeta, titleOfShelf } from "@/core/routing/documentTitle";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { ShelfPage } from "@/shelf";

export const Route = createFileRoute("/_mainLayout/shelf/$shelfId/")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const shelf = await context.qc
      .ensureQueryData(
        shelfDetailQuery(params.shelfId, {
          languages: readContext.languages.join(",") || undefined,
          appLocale: readContext.appLocale,
        }),
      )
      .catch(() => {
        throw notFound();
      });
    return { shelf, readContext };
  },
  head: ({ loaderData }) =>
    titleMeta(
      loaderData
        ? titleOfShelf(loaderData.shelf, loaderData.readContext)
        : null,
    ),
  component: () => {
    const { shelfId } = Route.useParams();
    return <ShelfPage unitId={shelfId} />;
  },
});
