import {useState} from 'react';
import {HomeSearchInputBase} from './HomeSearchInputBase';

export const SimpleSearchInput = ({
  onSearch,
  defaultValue,
  placeholder,
}: {
  onSearch: (value: string) => void;
  defaultValue: {keyword: string};
  placeholder: string;
}) => {
  const [value, setValue] = useState(defaultValue);

  return (
    <HomeSearchInputBase
      value={value.keyword ?? ''}
      onValueChange={keyword => setValue({keyword})}
      onSubmit={onSearch}
      placeholder={placeholder}
    />
  );
};
