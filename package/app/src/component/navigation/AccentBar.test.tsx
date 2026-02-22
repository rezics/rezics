import {useFixtureInput} from 'react-cosmos/client';
import {AccentBarContainer, AccentBarWithTextContainer} from './AccentBar';

export default function AccentBarTest() {
  const [barProps] = useFixtureInput<Parameters<typeof AccentBarContainer>[0]>(
    'Accent Bar Props',
    {
      height: 24,
    },
  );

  const [barWithTextProps] = useFixtureInput<
    Parameters<typeof AccentBarWithTextContainer>[0]
  >('Accent Bar With Text Props', {
    height: 24,
    text: '推荐阅读',
  });

  return (
    <div className="p-4 space-y-6">
      <div>
        <AccentBarContainer {...barProps} />
      </div>

      <div>
        <AccentBarWithTextContainer {...barWithTextProps} />
      </div>

      <div className="space-y-3">
        <AccentBarWithTextContainer text="默认主色" />
        <AccentBarWithTextContainer text="自定义颜色" color="#ec4899" />
      </div>
    </div>
  );
}
