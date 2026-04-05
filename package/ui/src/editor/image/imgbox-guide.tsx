import type {ImageProvider} from './types';
import {ExternalImageGuide} from './ExternalImageGuide';

export const imgboxGuide: ImageProvider = {
  name: 'imgbox',
  label: 'Imgbox',
  icon: <span className="text-xs font-bold">IB</span>,
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
