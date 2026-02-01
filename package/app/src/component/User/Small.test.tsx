import {useFixtureInput} from 'react-cosmos/client';
import {Small} from './Small';

export default () => {
  const [props] = useFixtureInput<Small>('Props', {
    id: '',
    name: '',
    subscriber: 1000,
    avatar: 'https://i.pravatar.cc/300',
  });

  return (
    <div className="outline outline-black">
      <Small {...props}></Small>
    </div>
  );
};
