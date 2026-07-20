def route(_action, _record, _changes, metadata) do
  enrichment = metadata.enrichment || %{}
  %{action: if(enrichment["indexable"], do: "index", else: "delete")}
end
