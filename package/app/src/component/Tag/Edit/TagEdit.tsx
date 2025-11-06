import React, {useEffect, useMemo, useState} from 'react';
import {TextField, Button, Autocomplete, CircularProgress} from '@mui/material';
import type {TagDetailDTO, CreateTagInput, UpdateTagInput} from '@/api/tag/tag';
import {useCreateTagMutation, useUpdateTagMutation} from '@/api/tag/tag';
import {unitApi} from '@/api/unit/unit';
import type {UnitDTO} from '@/api/unit/unit';

export type TagEditProps = {
  tag?: TagDetailDTO | null; // 若存在则为更新模式
  onSaved?: (tag: TagDetailDTO) => void;
  className?: string;
};

/**
 * TagEdit – 编辑 Tag 及其绑定的 domains
 * - 搜索 domain 使用 unitApi.search，过滤 type = 'DOMAIN'
 */
export const TagEdit: React.FC<TagEditProps> = ({tag, onSaved, className}) => {
  const isUpdate = !!tag;
  const [name, setName] = useState(tag?.name ?? '');
  const [type, setType] = useState<string | null>(tag?.type ?? null);
  const [domainIds, setDomainIds] = useState<string[]>(tag?.domains ?? []);

  // domain 搜索
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [options, setOptions] = useState<UnitDTO[]>([]);

  useEffect(() => {
    let mounted = true;
    const h = setTimeout(async () => {
      if (!q) {
        setOptions([]);
        return;
      }
      setSearching(true);
      try {
        const res = await unitApi.search(q, {type: 'DOMAIN', limit: 10});
        if (mounted) setOptions(res.units || []);
      } finally {
        if (mounted) setSearching(false);
      }
    }, 300);
    return () => {
      mounted = false;
      clearTimeout(h);
    };
  }, [q]);

  const createMutation = useCreateTagMutation({
    onSuccess: data => onSaved?.(data as TagDetailDTO),
  });
  const updateMutation = useUpdateTagMutation({
    onSuccess: data => onSaved?.(data as TagDetailDTO),
  });

  const busy = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateTagInput | UpdateTagInput = {
      name: name.trim(),
      type: type ?? null,
      domains: domainIds,
    };
    if (isUpdate && tag) {
      await updateMutation.mutateAsync({unitId: tag.id, input: payload});
    } else {
      await createMutation.mutateAsync(payload as CreateTagInput);
    }
  };

  const selectedDomainOptions = useMemo(() => {
    return domainIds.map(id => ({id, title: id}));
  }, [domainIds]);

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="tag-name" className="text-sm text-gray-600">
            名称
          </label>
          <TextField
            id="tag-name"
            size="small"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="tag-type" className="text-sm text-gray-600">
            类型
          </label>
          <TextField
            id="tag-type"
            size="small"
            value={type ?? ''}
            onChange={e => setType(e.target.value || null)}
            placeholder="可选，如：TOPIC / GENRE"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="tag-domains" className="text-sm text-gray-600">
            Domains
          </label>
          <Autocomplete
            multiple
            options={options}
            loading={searching}
            getOptionLabel={o => (o as any).title ?? (o as any).id}
            filterOptions={x => x} // 保留远程结果
            value={selectedDomainOptions as any}
            onChange={(_, values) => {
              setDomainIds(values.map(v => (v as any).id));
            }}
            renderInput={params => (
              <TextField
                {...params}
                id="tag-domains"
                size="small"
                placeholder="搜索域（DOMAIN）"
                onChange={e => setQ(e.target.value)}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searching ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <div className="text-xs text-gray-500">
            按名称搜索 Unit（类型为 DOMAIN）进行绑定
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={busy}
          >
            {isUpdate ? '保存修改' : '创建标签'}
          </Button>
          {busy && <CircularProgress size={18} />}
        </div>
      </div>
    </form>
  );
};

export default TagEdit;
