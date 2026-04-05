import Chip from '@mui/material/Chip';
import type {ImageProvider} from './types';
import {ExternalImageGuide} from './ExternalImageGuide';

export const imgboxGuide: ImageProvider = {
  name: 'imgbox',
  label: 'Imgbox',
  icon: <Chip label="IB" size="small" variant="outlined" />,
  render: ({onInsert}) => (
    <ExternalImageGuide
      name="Imgbox"
      url="https://imgbox.com"
      steps={[
        'Go to imgbox.com',
        'Select your image and upload it',
        'Copy the direct image link',
        'Paste the URL below',
      ]}
      onInsert={onInsert}
    />
  ),
};
