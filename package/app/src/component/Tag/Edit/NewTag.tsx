import React from 'react';
import type {TagDetailDTO} from '@package/api/tag/tag';
import {useAttachTagMutation} from '@package/api/tag/tag';
import TagEdit from './TagEdit';

export type NewTagProps = {
  /**
   * 若提供 objectUnitId，则在标签创建成功后会自动将该标签 attach 到此对象
   * （例如某本书的 unitId）。
   */
  objectUnitId?: string;
  /**
   * 标签创建完成后的回调（在可选的 attach 完成之后触发）
   */
  onCreated?: (tag: TagDetailDTO) => void | Promise<void>;
  className?: string;
};

/**
 * NewTag – 专注于“创建新标签”的简单包装组件
 * - 内部复用 TagEdit（仅使用创建模式）
 * - 可选：在创建成功后自动 attach 到指定对象
 */
export const NewTag: React.FC<NewTagProps> = ({
  objectUnitId,
  onCreated,
  className,
}) => {
  const attachMutation = useAttachTagMutation();

  const handleSaved = async (tag: TagDetailDTO) => {
    if (objectUnitId) {
      await attachMutation.mutateAsync({
        unitId: tag.id,
        targetUnitId: objectUnitId,
      });
    }
    await onCreated?.(tag);
  };

  return <TagEdit onSaved={handleSaved} className={className} />;
};

export default NewTag;
