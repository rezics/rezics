import {TextField} from '@mui/material';
import EasyEditor from '@/component/Form/EasyEditor';
import type {UnitFormData} from '@/api/unit/unit.types';
import {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {unitQueries} from '@/api/unit/unit.queries';
interface QuoteEditPageProps {
  data: UnitFormData;
  setData: (data: UnitFormData) => void;
}

export function QuoteEditPage({data, setData}: QuoteEditPageProps) {
  const source = useMemo(
    () => (data.metadata as any)?.source || '',
    [data.metadata],
  );

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <TextField
          id="quote-title"
          label="Title"
          variant="standard"
          value={data.title || ''}
          onChange={e => setData({...data, title: e.target.value})}
        />
      </div>

      <div className="flex flex-col gap-2">
        <TextField
          id="quote-source"
          label="Source"
          variant="standard"
          value={source}
          onChange={e =>
            setData({
              ...data,
              metadata: {...(data.metadata || {}), source: e.target.value},
            })
          }
        />
      </div>

      <div className="flex-1 min-h-[300px]">
        <EasyEditor
          value={data.content || ''}
          onChange={value => setData({...data, content: value})}
        />
      </div>
    </div>
  );
}

export function QuoteEditPageContainer({unitId}: {unitId: string}) {
  const {
    data: unitData,
    isLoading,
    error,
  } = useQuery(unitQueries.detail(unitId));
  const [quoteData, setQuoteData] = useState<UnitFormData>({} as UnitFormData);

  useEffect(() => {
    if (unitData) {
      setQuoteData({
        title: unitData.title || '',
        content: unitData.content || '',
        metadata: unitData.metadata || {},
        targetUnitId: unitData.targetUnitId || '',
        type: unitData.type || '',
        status: unitData.status || '',
      });
    }
  }, [unitData]);

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-4">
      <QuoteEditPage data={quoteData} setData={setQuoteData} />;
    </div>
  );
}
