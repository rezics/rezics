import {  useParams } from "wouter";

interface BookDetailRouteParams {
    id: string;
}

export const BookDetail = () => {
    const params: BookDetailRouteParams = useParams();
    return (
        <div>
            <h1>BookDetail</h1>
            <h1>{params.id}</h1>
        </div>
    );
};
