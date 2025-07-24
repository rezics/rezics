interface UserPageProps {   
    userId: string;
}

export function UserPage({ userId }: UserPageProps) {
    return (
        <div>
            <h1>User Page</h1>
            {userId}
        </div>
    )
}