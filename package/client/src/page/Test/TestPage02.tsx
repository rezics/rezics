import { useUserStore } from "@/global/userStore.ts";
import { Button } from "@mui/material";

export function TestPage02() {
    const user = useUserStore((state) => state.user);
    return (
        <div>
            <h1>Test Page 02</h1>
            <p>User: {user?.name}</p>
            <p>{user?.email}</p>
            <p>{user?.role}</p>
            <p>{user?.id}</p>
            <div>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                        useUserStore.setState({
                            user: {
                                id: "1",
                                name: "John Doe",
                                email: "john.doe@example.com",
                                role: "admin",
                            },
                        });
                    }}
                >
                    Set User
                </Button>
            </div>
        </div>
    );
}
