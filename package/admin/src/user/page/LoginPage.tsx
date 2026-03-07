import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import type {FormEvent} from 'react';
import {useState} from 'react';

import {useNavigate} from '@tanstack/react-router';

import {authApi} from '@package/api/auth/auth.api';

import {Route} from '@/routes/login';

function normalizeRedirect(to?: string) {
  if (!to) return '/';
  if (to.startsWith('/') && !to.startsWith('//')) return to;
  return '/';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const {redirect: redirectTo} = Route.useSearch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const {user} = await authApi.signIn({email, password});
      if (user?.role === 'admin' || user?.role === 'owner') {
        await navigate({to: normalizeRedirect(redirectTo), replace: true});
      } else {
        setError('You are not authorized to access this page');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{py: 8}}>
      <Paper
        elevation={0}
        sx={{p: 3, border: 1, borderColor: 'divider', borderRadius: 2}}
      >
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Admin Login
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
          Sign in to access the admin console.
        </Typography>

        {error && (
          <Alert severity="error" sx={{mb: 2}}>
            {error}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{display: 'grid', gap: 2}}
        >
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            fullWidth
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting}
          >
            {submitting ? (
              <Box sx={{display: 'inline-flex', alignItems: 'center', gap: 1}}>
                <CircularProgress size={18} color="inherit" />
                Signing in…
              </Box>
            ) : (
              'Sign in'
            )}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
