import type {ImageProvider} from './types';
import {ExternalImageGuide} from './ExternalImageGuide';

export const postimagesGuide: ImageProvider = {
  name: 'postimages',
  label: 'Postimages',
  icon: <span className="text-xs font-bold">PI</span>,
  render: ({onInsert}) => (
    <ExternalImageGuide
      name="Postimages"
      url="https://postimages.org"
      steps={[
        'Go to postimages.org',
        'Choose your image and upload it',
        'Copy the "Direct link" URL',
        'Paste the URL below',
      ]}
      onInsert={onInsert}
    />
  ),
};
