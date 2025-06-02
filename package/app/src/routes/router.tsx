import { Route, Router, Switch } from "wouter";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Auth/Login";
import { Register } from "@/pages/Auth/Register";
import { NotFound } from "@/pages/404";
import { MainLayout } from "@/layouts/MainLayout";

// Book
import { BookLib } from "@/pages/Book/BookLib";
import { BookDetail } from "@/pages/Book/BookPage";
import TestPage from "@/pages/Test/TestPage";

// 从 App.tsx 传入的 props 类型
interface AppRouterProps {
    mode: "light" | "dark";
    toggleTheme: () => void;
}

export default ({ mode, toggleTheme }: AppRouterProps) => (
    <Router>
        <Switch>
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route>
                <Switch>
                    <MainLayout mode={mode} toggleTheme={toggleTheme}>
                        <Route path="/" component={Home} />
                        <Route path="/books" component={BookLib} />
                        <Route path="/book/:id" component={BookDetail} />
                        <Route path="/test" component={TestPage} />
                    </MainLayout>
                </Switch>
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
