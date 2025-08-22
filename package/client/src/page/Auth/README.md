# Auth Components

该模块包含认证相关的组件，从 namespace 模式重构为组件化模式，提供更好的复用性和可维护性。

## 组件说明

### LoginShow
登录表单展示组件，可以在页面布局中使用，也可以在 Modal 中展示。

```tsx
import { LoginShow } from './LoginPage.tsx';

// 在页面中使用
<LoginShow
  loading={false}
  error={undefined}
  onSubmit={handleSubmit}
  onRegisterClick={() => navigate('/register')}
/>

// 在Modal中使用
<LoginShow
  loading={false}
  error={undefined}
  onSubmit={handleSubmit}
  onRegisterClick={() => setMode('register')}
  isModal={true}
  hideActions={false}
/>
```

### RegisterShow
注册表单展示组件，同样支持页面和Modal两种使用方式。

```tsx
import { RegisterShow } from './RegisterPage.tsx';

// 在页面中使用
<RegisterShow
  loading={false}
  error={undefined}
  onSubmit={handleSubmit}
  onLoginClick={() => navigate('/login')}
/>

// 在Modal中使用
<RegisterShow
  loading={false}
  error={undefined}
  onSubmit={handleSubmit}
  onLoginClick={() => setMode('login')}
  isModal={true}
/>
```

### LoginPage / RegisterPage
完整的页面容器组件，包含状态管理和表单处理逻辑。

```tsx
import { LoginPage, RegisterPage } from './index.ts';

// 直接在路由中使用
<Route path="/login" component={LoginPage} />
<Route path="/register" component={RegisterPage} />
```

### AuthModal
认证模态框组件，可以在登录和注册之间切换。

```tsx
import { AuthModal } from './AuthModal.tsx';

<AuthModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  initialMode="login"
/>
```

### useAuthModal Hook
管理认证模态框状态的 Hook。

```tsx
import { useAuthModal } from './useAuthModal.tsx';

function MyComponent() {
  const { isOpen, openLogin, openRegister, close, AuthModal } = useAuthModal();

  return (
    <div>
      <Button onClick={openLogin}>Login</Button>
      <Button onClick={openRegister}>Register</Button>
      <AuthModal />
    </div>
  );
}
```

## 主要改进

1. **从 namespace 改为组件化**: 更符合 React 最佳实践
2. **更好的复用性**: 组件可以在不同场景下使用（页面、Modal）
3. **清晰的职责分离**: Show 组件负责展示，Page 组件负责状态管理
4. **类型安全**: 完整的 TypeScript 类型定义
5. **可扩展性**: 容易添加新的变体和功能

## 使用场景

- **页面使用**: 直接作为登录/注册页面
- **Modal使用**: 在任何页面弹出登录/注册模态框
- **嵌入使用**: 在其他组件中嵌入认证表单
