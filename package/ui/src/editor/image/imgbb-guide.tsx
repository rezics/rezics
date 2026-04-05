import Chip from '@mui/material/Chip';
import type {ImageProvider} from './types';
import {ExternalImageGuide} from './ExternalImageGuide';

export const imgbbGuide: ImageProvider = {
  name: 'imgbb',
  label: 'ImgBB',
  icon: <Chip label="BB" size="small" variant="outlined" />,
  render: ({onInsert}) => (
    <ExternalImageGuide
      name="ImgBB"
      url="https://imgbb.com"
      steps={[
        'Go to imgbb.com and click "Start Uploading"',
        'Select your image and upload it',
        'Copy the "Direct link" URL from the results',
        'Paste the URL below',
      ]}
      onInsert={onInsert}
    />
  ),
};
