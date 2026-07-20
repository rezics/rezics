def transform(_action, record, _changes, metadata) do
  enrichment = metadata.enrichment || %{}
  if enrichment["indexable"] do
    enrichment["document"]
  else
    %{"id" => Kernel.to_string(record["unit_id"])}
  end
end
