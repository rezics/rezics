interface UserPageProps {   
    userId: string;
}

export function UserPage({ userId }: UserPageProps) {
    return (
        <div className="w-11/12 mx-auto mt-10">
            <h1>User Page</h1>
            {userId}
        </div>
    )
}