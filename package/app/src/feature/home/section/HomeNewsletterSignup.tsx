import React, {useState} from 'react';
import {Button, TextField, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';

export const HomeNewsletterSignup: React.FC = () => {
  const {t} = useTranslation();
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
        {t('page.home.sections.newsletter.title')}
      </Typography>
      {submitted ? (
        <Typography variant="body2" color="success.main">
          {t('page.home.sections.newsletter.thanks')}
        </Typography>
      ) : (
        <form className="flex gap-2" onSubmit={onSubmit}>
          <TextField
            size="small"
            type="email"
            required
            placeholder={t('page.home.sections.newsletter.email_placeholder')}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Button type="submit" variant="contained">
            {t('page.home.sections.newsletter.submit')}
          </Button>
        </form>
      )}
    </div>
  );
};

export default HomeNewsletterSignup;

