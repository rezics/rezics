import React, {useState} from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import {useCreateFeedbackMutation} from '@/api/feedback/feedback.mutations';
import type {CreateFeedbackInput} from '@/api/feedback/feedback.types';
import { useRouterState } from '@tanstack/react-router';
import {useEffect} from 'react';

type FeedbackFormProps = {
  defaultValues?: Partial<CreateFeedbackInput>;
  onSubmitted?: () => void;
};

const typeOptions: {value: CreateFeedbackInput['type']; label: string}[] = [
  {value: 'BUG', label: '问题/缺陷'},
  {value: 'FEATURE', label: '功能建议'},
  {value: 'REPORT', label: '内容相关'},
  {value: 'OTHER', label: '其他'},
];

const FeedbackForm: React.FC<FeedbackFormProps> = ({
  defaultValues,
  onSubmitted,
}) => {
  const locationKey = useRouterState({
    select: s => `${s.location.pathname}${s.location.search ?? ''}`,
  });
  const [form, setForm] = useState<CreateFeedbackInput>({
    url: '',
    content: defaultValues?.content ?? '',
    type: defaultValues?.type ?? 'BUG',
  });

  useEffect(() => {
    setForm(prev => ({...prev, url: locationKey}));
  }, [locationKey]);

  const [errors, setErrors] = useState({
    content: false,
  });

  const createMutation = useCreateFeedbackMutation();

  const handleChange = (field: keyof CreateFeedbackInput, value: string) => {
    setForm(prev => ({...prev, [field]: value}));
    setErrors(prev => ({...prev, [field]: false}));
  };

  const validate = () => {
    const newErrors = {
      content: !form.content.trim(),
    };
    setErrors(newErrors);
    return !newErrors.content;
  };

  const resetForm = () => {
    setForm({
      content: '',
      type: 'BUG',
    });
    setErrors({content: false});
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    createMutation.mutate(form, {
      onSuccess: () => {
        resetForm();
        onSubmitted?.();
      },
    });
  };

  return (
    <Box component="form" onSubmit={onSubmit} className="space-y-4">
      <Stack spacing={2}>
        <TextField
          label="反馈类型"
          select
          value={form.type}
          onChange={e => handleChange('type', e.target.value)}
        >
          {typeOptions.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="详细内容"
          placeholder="请提供详细描述、复现步骤或预期效果"
          multiline
          minRows={4}
          value={form.content}
          onChange={e => handleChange('content', e.target.value)}
          error={errors.content}
          helperText={errors.content ? '请填写详细内容' : ''}
        />

        {createMutation.status === 'error' && (
          <Typography color="error">提交失败，请稍后重试。</Typography>
        )}

        <Stack direction="row" spacing={2} className="justify-end">
          <Button variant="outlined" onClick={resetForm}>
            重置
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={createMutation.status === 'pending'}
          >
            {createMutation.status === 'pending' ? '提交中...' : '提交反馈'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default FeedbackForm;
