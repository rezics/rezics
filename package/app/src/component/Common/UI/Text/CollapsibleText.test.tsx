import {useFixtureInput} from 'react-cosmos/client';
import {CollapsibleTextContainer} from './CollapsibleText';

export default function CollapsibleTextTest() {
  const [props] = useFixtureInput<
    Parameters<typeof CollapsibleTextContainer>[0]
  >('Props', {
    content:
      '这是一个很长的文本内容，用来测试 CollapsibleText 组件的功能。当文本长度超过阈值时，会显示省略号和展开/收起按钮。用户可以点击按钮来展开或收起文本内容。这个组件在显示长文本时非常有用，可以节省页面空间，提供更好的用户体验。',
    threshold: 100,
  });

  return (
    <div className="p-4 max-w-md mx-auto">
      <CollapsibleTextContainer {...props} />
    </div>
  );
}
