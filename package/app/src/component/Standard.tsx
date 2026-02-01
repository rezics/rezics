/**
 * 组件开发应该遵循本组件的规范，以保证组件的质量。
 */

import {useEffect, useState} from 'react';

/**
 * 组件应该导出一个命名空间，包含 Show 和 Container 两个类型或函数。
 */
export namespace Standard {
  /**
   * Show 类型是 Show 组件的 props 类型。
   * Show 函数是一个纯函数，给定相同的 Show props，永远返回相同的 JSX，不产生副作用。
   */
  export type Show = {
    title: string;
    description: string;
  };
  export const Show: React.FC<Show> = ({title, description}) => {
    return (
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    );
  };

  /**
   * Container 类型是 Container 组件的 props 类型。
   * Container 函数是一个包装器，自动管理内部状态，并传递给 Show 组件。
   */
  export type Container = {
    link: string;
  };
  export const Container: React.FC<Container> = ({link}) => {
    const [data, setData] = useState<Show>({
      title: '',
      description: '',
    });

    useEffect(() => {
      fetch(link)
        .then(res => res.json())
        .then(data => setData(data));
    }, [link]);
    return <Show {...data} />;
  };
}
