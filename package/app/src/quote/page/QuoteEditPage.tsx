import {Button, TextField} from '@mui/material';
import EasyEditor from '@package/ui/editor/easyeditor/EasyEditor.tsx';
import type {UnitFormData} from '@package/api/unit/unit.types';
import {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {unitQueries} from '@package/api/unit/unit.queries';
import {useUpdateUnitMutation} from '@package/api/unit/unit.mutations';
import {useAlertStore} from '@app/state/windowAlertStore';
import {useTranslation} from 'react-i18next';
import {quoteEditRoute} from '@/router';
interface QuoteEditPageProps {
  unitId: string;
  data: UnitFormData;
  setData: (data: UnitFormData) => void;
}

export function QuoteEditPage({unitId, data, setData}: QuoteEditPageProps) {
  const {t} = useTranslation();
  const {show} = useAlertStore();
  const source = useMemo(
    () => (data.metadata as any)?.source || '',
    [data.metadata],
  );

  const {mutate, isPending} = useUpdateUnitMutation({
    onSuccess: data => {
      show(t('quote.updated_success'));
      console.log('update quote success', data);
    },
    onError: error => {
      show(t('quote.messages.update_failed', {error: String(error)}));
      console.error('update quote failed', error);
    },
  });

  function handleSave() {
    mutate({
      unitId: unitId,
      input: {
        title: data.title,
        content: data.content,
        // status: data.status || '', // not support now
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <TextField
          id="quote-title"
          label={t('quote.form.title')}
          variant="standard"
          value={data.title || ''}
          onChange={e => setData({...data, title: e.target.value})}
        />
      </div>

      <div className="flex flex-col gap-2">
        <TextField
          id="quote-source"
          label={t('quote.form.source')}
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
      <Button variant="contained" color="primary" onClick={handleSave}>
        {t('common.save')}
      </Button>
    </div>
  );
}

export function QuoteEditPageContainer() {
  const {unitId} = quoteEditRoute.useParams();
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
      <QuoteEditPage unitId={unitId} data={quoteData} setData={setQuoteData} />;
    </div>
  );
}
