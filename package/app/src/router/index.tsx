import { Route, Router, Switch } from "wouter";
import { Home } from "@/page/Home";
import { Login } from "@/page/Auth/Login";
import { Register } from "@/page/Auth/Register";
import { NotFound } from "@/page/NotFound";
import { MainLayout } from "@/layout/MainLayout";

// Book
import { BookLib } from "@/page/Book/BookLib";
import { BookDetail } from "@/page/Book/BookPage";
import TestPage from "@/page/Test/TestPage";
import { ThemeProvider } from "@mui/material";

export default (
    <Router>
        <ThemeProvider theme={{}}>
            <MainLayout>
                <Switch>
                    <Route path="/login" component={Login} />
                    <Route path="/register" component={Register} />
                    <Route>
                        <Switch>
                            <Route path="/" component={Home} />
                            <Route path="/books" component={BookLib} />
                            <Route path="/book/:id" component={BookDetail} />
                            <Route path="/test" component={TestPage} />
                        </Switch>
                    </Route>

                    <NotFound />
                </Switch>
            </MainLayout>
        </ThemeProvider>
    </Router>
);
