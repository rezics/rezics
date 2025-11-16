import {useFixtureInput} from 'react-cosmos/client';
import {ReactionBarContainer} from './ReactionBar';

export default function ReactionBarTest() {
  const [props] = useFixtureInput<Parameters<typeof ReactionBarContainer>[0]>(
    'Props',
    {
      onReply: () => {},
      className: '',
      size: 'large',
      fontSize: '1.5rem',
    },
  );

  return <ReactionBarContainer {...props} />;
}
