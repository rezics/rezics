import {useFixtureInput} from 'react-cosmos/client';
import {AccentBar} from './AccentBar';

export default function AccentBarTest() {
  const [barProps] = useFixtureInput<Parameters<typeof AccentBar>[0]>(
    'Accent Bar Props',
    {
      height: 24,
    },
  );

  const [barWithTextProps] = useFixtureInput<Parameters<typeof AccentBar>[0]>(
    'Accent Bar With Text Props',
    {
      height: 24,
    },
  );

  return (
    <div className="p-4 space-y-6">
      <div>
        <AccentBar {...barProps} />
      </div>
    </div>
  );
}
