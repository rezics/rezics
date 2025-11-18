import {TextField} from '@mui/material';
import EasyEditor from '@/component/Form/EasyEditor';
import type {UnitFormData} from '@/api/unit/unit.types';
import {useMemo} from 'react';

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
