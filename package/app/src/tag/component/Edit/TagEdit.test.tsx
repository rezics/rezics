import React, {useEffect, useState} from 'react';
import {useFixtureInput} from 'react-cosmos/client';
import TagEdit from './TagEdit';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import type {TagDetailDTO} from '@rezics/api/tag/tag';
import {tagApi} from '@rezics/api/tag/tag';
import {unitApi} from '@rezics/api/unit/unit';

/**
 * Cosmos Fixture: TagEdit
 * 用例：通过 useFixtureInput 动态切换创建 / 更新模式，观察保存结果
 * - mode: 'create' | 'update'
 * - mock: 拦截 tagApi 与 unitApi.search 以避免真实网络请求
 */
export default function TagEditFixture() {
  // 基本模式切换：创建 / 更新
  const [mode] = useFixtureInput<'create' | 'update'>('mode', 'create');
  // 搜索关键字仅用于展示（组件内部自有 debounce & 状态）
  const [debugDomainQuery] = useFixtureInput<string>('debugDomainQuery', 'dom');
  // 控制搜索结果数量，方便观察 Autocomplete 行为
  const [searchResultCount] = useFixtureInput<number>('searchResultCount', 3);
  // 模拟请求失败场景（仅 create 模式）
  const [simulateError] = useFixtureInput<boolean>('simulateError', false);

  // 保存结果显示
  const [saved, setSaved] = useState<TagDetailDTO | null>(null);
  // 最近一次错误（仅简单展示）
  const [lastError, setLastError] = useState<string | null>(null);

  // --- Mock Layer ---------------------------------------------------------
  useEffect(() => {
    // Preserve originals once
    (tagApi as any)._origCreate ||= tagApi.create;
    (tagApi as any)._origUpdate ||= tagApi.update;
    (unitApi as any)._origSearch ||= unitApi.search;

    tagApi.create = async (input: any) => {
      if (simulateError) {
        const err = new Error('模拟创建失败 (simulateError=true)');
        setLastError(err.message);
        throw err;
      }
      const fake: TagDetailDTO = {
        id: 'tag_' + Date.now(),
        name: input.name,
        type: input.type ?? null,
        domains: input.domains ?? [],
      } as TagDetailDTO;
      return fake as any;
    };
    tagApi.update = async (unitId: string, input: any) => {
      const fake: TagDetailDTO = {
        id: unitId,
        name: input.name + '_updated',
        type: input.type ?? null,
        domains: input.domains ?? [],
      } as TagDetailDTO;
      return fake as any;
    };
    unitApi.search = async (query: string, _filters: any) => {
      const units = Array.from({length: searchResultCount}).map((_, i) => ({
        id: `domain_${i}_${query}`,
        title: `Domain ${i} (${query})`,
      }));
      return {units} as any;
    };
    return () => {
      if ((tagApi as any)._origCreate)
        tagApi.create = (tagApi as any)._origCreate;
      if ((tagApi as any)._origUpdate)
        tagApi.update = (tagApi as any)._origUpdate;
      if ((unitApi as any)._origSearch)
        unitApi.search = (unitApi as any)._origSearch;
    };
  }, [searchResultCount, simulateError]);
  // -----------------------------------------------------------------------

  // 更新模式下提供一个初始 tag
  const updateTag: TagDetailDTO | null =
    mode === 'update'
      ? {
          id: 'tag_existing_1',
          name: '现有标签',
          type: 'GENRE',
          domains: ['domain_old'],
        }
      : null;

  const qc = React.useMemo(() => new QueryClient(), []);

  return (
    <div className="pt-4 pl-4">
      <QueryClientProvider client={qc}>
        <div style={{display: 'flex', gap: 24, alignItems: 'flex-start'}}>
          <div style={{flex: '0 0 420px'}}>
            <TagEdit
              tag={updateTag}
              onSaved={t => {
                setSaved(t);
                setLastError(null);
              }}
              className="p-4 border rounded-md space-y-4"
            />
          </div>
          <div style={{flex: 1, fontSize: 12}}>
            <h3 style={{marginTop: 0}}>TagEdit Fixture 控制台</h3>
            <div>
              mode: <code>{mode}</code>
            </div>
            <div>
              debugDomainQuery: <code>{debugDomainQuery}</code>
            </div>
            <div>
              searchResultCount: <code>{searchResultCount}</code>
            </div>
            <div>
              simulateError: <code>{String(simulateError)}</code>
            </div>
            <div style={{marginTop: 12}}>
              <strong>已保存 (onSaved):</strong>
              <pre style={{background: '#f5f5f5', padding: 8, borderRadius: 4}}>
                {saved ? JSON.stringify(saved, null, 2) : '尚未保存'}
              </pre>
            </div>
            {lastError && (
              <div style={{color: '#d22', marginTop: 8}}>错误: {lastError}</div>
            )}
            <p style={{color: '#666'}}>
              使用上方控制项动态观察组件：
              <br />• 切换 mode 进入创建 / 更新
              <br />• 调整 searchResultCount 观察 Autocomplete 下拉数量
              <br />• 打开 simulateError 测试 mutation
              错误分支（由于组件暂未显示错误，仅在 fixture 面板记录）
            </p>
          </div>
        </div>
      </QueryClientProvider>
    </div>
  );
}
