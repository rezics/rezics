import React, {useState, useImperativeHandle} from 'react';
import TextField from '@mui/material/TextField';
import {CooldownButton} from '@/component/Common/UI/Button/CooldownButton';
import {validateEmail} from './lib/validate';
import {userApi} from '@/api/user/user';
import {useAlertStore} from '@/global/windowAlertStore';

export interface GetVerificationCodeHandle {
  handleTurnstileVerify: (token: string) => Promise<void>;
}

interface GetVerificationCodeProps {
  data: any;
  setData: (data: any) => void;
  setShowTurnstile: (show: boolean) => void;
  setError: (error: string) => void;
  ref: React.Ref<GetVerificationCodeHandle>;
}

export function GetVerificationCode({
  data,
  setData,
  setShowTurnstile,
  setError,
  ref,
}: GetVerificationCodeProps) {
  const {show: showAlert} = useAlertStore();
  const [sendingCode, setSendingCode] = useState(false);
  const [emailForVerificationCode, setEmailForVerificationCode] = useState<
    string | null
  >(null);

  const handleRequestVerificationCode = (email: string) => {
    const validateData = validateEmail(email);
    if (!validateData.valid) {
      setError(validateData.error ?? 'Invalid email address');
      return;
    }
    setEmailForVerificationCode(email);
    setShowTurnstile(true);
  };

  useImperativeHandle(ref, () => ({
    async handleTurnstileVerify(token: string) {
      if (!emailForVerificationCode) return;
      try {
        setSendingCode(true);
        await userApi.sendVerificationCode({
          email: emailForVerificationCode,
          turnstileToken: token,
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        showAlert('Verification code sent successfully');
        setSendingCode(false);
        setShowTurnstile(false);
      }
    },
  }));
  return (
    <div className="flex items-center gap-0">
      <TextField
        name="verificationCode"
        type="text"
        label="Verification Code"
        variant="standard"
        value={data?.verificationCode ?? ''}
        onChange={event => {
          setData({...data, verificationCode: event.target.value});
        }}
        margin="none"
        className="flex-grow"
      />

      <CooldownButton
        cooldownMs={30000}
        type="button"
        variant="outlined"
        onClick={() => handleRequestVerificationCode(data.email)}
        size="small"
        className="!ml-2 h-10 px-3"
      >
        {sendingCode ? 'Sending...' : 'Get code'}
      </CooldownButton>
    </div>
  );
}
