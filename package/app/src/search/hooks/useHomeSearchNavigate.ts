import {useNavigate} from '@tanstack/react-router';
import {buildBookSearchPath} from '../util/searchQuery';

export function useHomeSearchNavigate() {
  const navigate = useNavigate();

  return {
    navigateByKeyword: (keyword: string) => {
      navigate({to: buildBookSearchPath({keyword})});
    },
    navigateBySearchInfo: (value: {
      keyword?: string;
      tags?: string[];
      nsfw?: boolean;
      isLicensed?: boolean;
      textLength?: string;
    }) => {
      navigate({to: buildBookSearchPath(value)});
    },
  };
}
