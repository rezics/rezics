import { Redirect, Route, Router, Switch } from "wouter";
import { Home } from "@/page/Home";
import { Login } from "@/page/Auth/Login";
import { Register } from "@/page/Auth/Register";

export default (
    <Router>
        <Switch>
            <Route path="/auth/login" component={Login}></Route>
            <Route path="/auth/register" component={Register}></Route>

            <Route path="/" component={Home}></Route>
            <Redirect to="/"></Redirect>
        </Switch>
    </Router>
);
