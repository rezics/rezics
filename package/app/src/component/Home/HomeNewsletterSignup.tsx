import React, {useState} from 'react';
import {Button, TextField, Typography} from '@mui/material';

export const HomeNewsletterSignup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder: integrate backend later
    console.log('newsletter signup', email);
    setSubmitted(true);
  };

  return (
    <div className="w-full rounded border p-4 bg-white">
      <Typography variant="subtitle1" className="mb-2">
        订阅最新资讯
      </Typography>
      {submitted ? (
        <Typography variant="body2" color="success.main">
          感谢订阅！
        </Typography>
      ) : (
        <form className="flex gap-2" onSubmit={onSubmit}>
          <TextField
            size="small"
            type="email"
            required
            placeholder="输入你的邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Button type="submit" variant="contained">
            订阅
          </Button>
        </form>
      )}
    </div>
  );
};

export default HomeNewsletterSignup;
