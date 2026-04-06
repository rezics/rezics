const DialogReplyTest = () => {
  return (
    <div className="p-4">
      <h3 className="mb-4 text-lg font-semibold">对话框回复组件</h3>
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          注意：此组件依赖于 useDialogStore 全局状态管理，在 Cosmos
          中可能无法正常工作。 这里只是展示组件的静态结构。
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <p className="mb-2">点击下方按钮会打开对话框：</p>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => alert("在实际应用中，这里会打开 DialogReply 组件")}
        >
          打开回复对话框
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>DialogReply 组件特点：</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>使用 Material-UI Dialog 组件</li>
          <li>包含标题、内容区域和操作按钮</li>
          <li>依赖 useDialogStore 管理状态</li>
          <li>支持国际化（使用 t 函数）</li>
        </ul>
      </div>
    </div>
  );
};

export default DialogReplyTest;
