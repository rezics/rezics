import {useFixtureInput} from 'react-cosmos/client';
import {ArrowForwardIconContainer} from './ArrowForwardIcon';

export default function ArrowForwardIconTest() {
  const [props] = useFixtureInput<
    Parameters<typeof ArrowForwardIconContainer>[0]
  >('Props', {
    size: 24,
    children: '点击查看更多',
  });
  function Default() {
    return (
      <div className="p-4">
        <ArrowForwardIconContainer {...props} />
      </div>
    );
  }

  function Sizes() {
    return (
      <div className="p-4 space-y-4">
        <div>
          <ArrowForwardIconContainer size={16}>
            小尺寸
          </ArrowForwardIconContainer>
        </div>
        <div>
          <ArrowForwardIconContainer size={24}>
            中等尺寸
          </ArrowForwardIconContainer>
        </div>
        <div>
          <ArrowForwardIconContainer size={32}>
            大尺寸
          </ArrowForwardIconContainer>
        </div>
      </div>
    );
  }

  function Examples() {
    return (
      <div className="p-4 space-y-4">
        <div>
          <ArrowForwardIconContainer>查看详情</ArrowForwardIconContainer>
        </div>
        <div>
          <ArrowForwardIconContainer>继续阅读</ArrowForwardIconContainer>
        </div>
        <div>
          <ArrowForwardIconContainer>了解更多</ArrowForwardIconContainer>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Default />
      <Sizes />
      <Examples />
    </div>
  );
}
