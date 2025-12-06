import 'react-json-view-lite/dist/index.css';
import {JsonEditorLight} from '@/component/Form/JsonEditorLight';

interface BookExtraEditorProps {
  value?: any;
  onChange?: (value: any) => void;
}

export function BookExtraEditor({value, onChange}: BookExtraEditorProps) {
  return <JsonEditorLight value={value} onChange={onChange} />;
}
