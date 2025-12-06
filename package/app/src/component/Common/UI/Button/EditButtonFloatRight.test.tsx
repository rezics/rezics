import {useFixtureInput} from 'react-cosmos/client';
import {EditButtonFloatRightContainer} from './EditButtonFloatRight';

export default {
  Default: () => {
    const [props] = useFixtureInput<
      Parameters<typeof EditButtonFloatRightContainer>[0]
    >('Props', {
      onClick: () => console.log('Edit clicked'),
      text: '编辑',
    });

    return (
      <div className="p-4 border border-gray-200 rounded">
        <EditButtonFloatRightContainer {...props} />
      </div>
    );
  },

  CustomText: () => {
    const [props] = useFixtureInput<
      Parameters<typeof EditButtonFloatRightContainer>[0]
    >('Props', {
      onClick: () => console.log('Modify clicked'),
      text: '修改',
    });

    return (
      <div className="p-4 border border-gray-200 rounded">
        <EditButtonFloatRightContainer {...props} />
      </div>
    );
  },
};
