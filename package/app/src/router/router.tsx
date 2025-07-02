import { Route, Router, Switch } from "wouter";
import { Home } from "@/page/Home";
import { Login } from "@/page/Auth/Login";
// import { Register } from "@/page/Auth/Register";
import { NotFound } from "@/page/NotFound";
import { MainLayout } from "@/layout/MainLayout";

// Book
import { BookLib } from "@/page/Book/BookLibPage";
import { BookDetail } from "@/page/Book/BookPage";
import TestPage from "@/page/Test/TestPage";
import { ThemeProvider } from "@mui/material";

// Book Edit
import { BookEditLayout } from "@/layout/BookEditLayout";
import { BookEditMainPage } from "@/page/Book/BookEditMainPage";
import { BookEditChapterPage } from "@/page/Book/BookEditChapterPage";

// Book Read
import { BookReadLayout } from "@/layout/BookReadLayout";
import { BookReadChapterPage } from "@/page/Book/BookReadChapterPage";


// BookList
import { BookListPage } from "@/page/BookList/BookListPage";

export default (
    <Router>
        <ThemeProvider theme={{}}>
            <Switch>
                {/* Auth */}
                <Route path="/login" component={Login} />
                <Route path="/register" component={Login} />

                {/* Book Read */}
                <Route path="/book/:id/read" nest>
                    <BookReadLayout>
                        <Route path="/:chapterId" component={BookReadChapterPage} />
                    </BookReadLayout>
                </Route>

                {/* Book Edit */}
                <Route path="/book/:id/edit" nest>
                    <BookEditLayout>
                        <Switch>
                            <Route path="/" component={BookEditMainPage}></Route>
                            <Route path="/:chapterId" component={BookEditChapterPage}></Route>
                        </Switch>
                    </BookEditLayout>
                </Route>

                {/* Main */}
                <Route>
                    <MainLayout>
                        <Switch>
                            <Route path="/books" component={BookLib} />
                            <Route path="/book/:id" component={BookDetail} />
                            <Route path="/booklist/:id" component={BookListPage} />
                            <Route path="/test" component={TestPage} />
                            <Route path="/" component={Home} />
                            <Route component={NotFound} />
                        </Switch>
                    </MainLayout>
                </Route>
            </Switch>
        </ThemeProvider>
    </Router>
);
