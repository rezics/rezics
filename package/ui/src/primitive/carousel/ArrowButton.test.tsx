import {useFixtureInput} from 'react-cosmos/client';
import {ArrowButton} from './ArrowButton';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

export default function ArrowButtonTest() {
  const [props] = useFixtureInput<Parameters<typeof ArrowButton>[0]>('Props', {
    icon: KeyboardArrowLeftIcon,
    className: '',
  });

  function Default() {
    return (
      <div className="p-4 space-y-4">
        <ArrowButton {...props} />
      </div>
    );
  }

  function LeftRight() {
    return (
      <div className="p-4 space-x-4 flex items-center">
        <ArrowButton icon={KeyboardArrowLeftIcon} />
        <ArrowButton icon={KeyboardArrowRightIcon} />
      </div>
    );
  }

  function Sizes() {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-4">
          <ArrowButton
            icon={KeyboardArrowLeftIcon}
            className="h-8 w-8 text-[16px]"
          />
          <span>小尺寸 (16)</span>
        </div>
        <div className="flex items-center space-x-4">
          <ArrowButton icon={KeyboardArrowLeftIcon} className="text-[24px]" />
          <span>中等尺寸 (24)</span>
        </div>
        <div className="flex items-center space-x-4">
          <ArrowButton
            icon={KeyboardArrowLeftIcon}
            className="h-12 w-12 text-[32px]"
          />
          <span>大尺寸 (32)</span>
        </div>
      </div>
    );
  }

  function WithClassName() {
    return (
      <div className="p-4 space-x-4 flex items-center">
        <ArrowButton icon={KeyboardArrowLeftIcon} className="opacity-50" />
        <ArrowButton icon={KeyboardArrowRightIcon} className="opacity-50" />
      </div>
    );
  }

  function Disabled() {
    return (
      <div className="p-4 space-x-4 flex items-center">
        <ArrowButton icon={KeyboardArrowLeftIcon} disabled />
        <ArrowButton icon={KeyboardArrowRightIcon} disabled />
      </div>
    );
  }

  return (
    <div>
      <Default />
      <LeftRight />
      <Sizes />
      <WithClassName />
      <Disabled />
    </div>
  );
}
