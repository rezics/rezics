import { Route, Router, Switch } from "wouter";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Auth/Login";
import { Register } from "@/pages/Auth/Register";
import { NotFound } from "@/pages/404";
import { MainLayout } from "@/layouts/MainLayout";

// 从 App.tsx 传入的 props 类型
interface AppRouterProps {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

export default ({ mode, toggleTheme }: AppRouterProps) => (
    <Router>
        <Switch>
            <Route path="/login">
                <Login />
            </Route>
            <Route path="/register">
                <Register />
            </Route>

            <Route path="/">
                <MainLayout mode={mode} toggleTheme={toggleTheme}>
                    <Home />
                </MainLayout>
            </Route>
            {/* Catch all other routes */}
            <Route path="*">
                <MainLayout mode={mode} toggleTheme={toggleTheme}>
                    <NotFound />
                </MainLayout>
            </Route>
        </Switch>
    </Router>
);
