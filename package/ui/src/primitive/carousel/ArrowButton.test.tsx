import {useFixtureInput} from 'react-cosmos/client';
import {ArrowButton} from './ArrowButton';
import {ArrowLeft} from './ArrowLeft';
import {ArrowRight} from './ArrowRight';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';

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
        <ArrowLeft />
        <ArrowRight />
      </div>
    );
  }

  function Sizes() {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-4">
          <ArrowLeft size={16} />
          <span>小尺寸 (16)</span>
        </div>
        <div className="flex items-center space-x-4">
          <ArrowLeft size={24} />
          <span>中等尺寸 (24)</span>
        </div>
        <div className="flex items-center space-x-4">
          <ArrowLeft size={32} />
          <span>大尺寸 (32)</span>
        </div>
      </div>
    );
  }

  function WithClassName() {
    return (
      <div className="p-4 space-x-4 flex items-center">
        <ArrowLeft className="opacity-50" />
        <ArrowRight className="opacity-50" />
      </div>
    );
  }

  return (
    <div>
      <Default />
      <LeftRight />
      <Sizes />
      <WithClassName />
    </div>
  );
}
