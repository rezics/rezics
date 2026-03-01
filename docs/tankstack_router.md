  
## Match Router

```
const matchRoute = useMatchRoute();
const isMeiliMode = Boolean(matchRoute({to: '/users/meili'}));
```

```
const routeMatch = useMatch({from: UserEditRoute.id, shouldThrow: false});
```
