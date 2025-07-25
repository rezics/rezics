import s from "./s";
import c from "contract";

export default s.router(c.Homepage, {
    get: async () => {
        try {
            // Mock homepage data
            const homepage = {
                id: "homepage-1",
                content: JSON.stringify({
                    hero: {
                        title: "Welcome to Our Book Platform",
                        subtitle: "Discover, read, and share amazing books",
                        backgroundImage: "/images/hero-bg.jpg"
                    },
                    featuredBooks: [
                        {
                            id: "book_1",
                            name: "Sample Book",
                            description: "This is a sample book for testing",
                            cover: "https://via.placeholder.com/300x400",
                            author: [{ id: "author_1", name: "Sample Author" }]
                        }
                    ],
                    popularTags: [
                        { id: "tag_1", name: "Fiction" },
                        { id: "tag_2", name: "Science Fiction" },
                        { id: "tag_3", name: "Fantasy" }
                    ],
                    recentActivity: [],
                    stats: {
                        totalBooks: 1,
                        totalAuthors: 1,
                        totalReaders: 0
                    }
                })
            };

            return {
                status: 200,
                body: homepage
            };
        } catch (error) {
            console.error("Homepage error:", error);
            return {
                status: 500,
                body: {
                    id: "homepage-error",
                    content: JSON.stringify({
                        error: "Failed to load homepage content"
                    })
                }
            };
        }
    },
});