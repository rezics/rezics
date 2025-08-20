export const mockUsers = [
    {
        id: "1",
        name: "John Doe",
        avatar: "https://i.pravatar.cc/150?img=1",
    },
    {
        id: "2",
        name: "Jane Smith",
        avatar: "https://i.pravatar.cc/150?img=2",
    },
    {
        id: "3",
        name: "Mike Johnson",
        avatar: "https://i.pravatar.cc/150?img=3",
    },
];

export const mockReviews = [
    {
        id: "1",
        bookId: "1",
        content:
            "This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.",
        rating: 4.5,
        created_at: "2024-03-15T10:30:00Z",
        userId: "1",
    },
    {
        id: "2",
        bookId: "1",
        content:
            "A solid read with interesting concepts. While I enjoyed the story, I felt some parts could have been developed further. Still worth reading though!",
        rating: 3.8,
        created_at: "2024-03-14T15:45:00Z",
        userId: "2",
    },
    {
        id: "3",
        bookId: "1",
        content:
            "One of the best books I've read this year. The author's writing style is captivating and the world-building is exceptional. Can't wait to read more from this author!",
        rating: 5.0,
        created_at: "2024-03-13T09:15:00Z",
        userId: "3",
    },
];

export const mockBookShortReviews = [
    {
        id: "1",
        user: {
            id: "1",
            name: "张三",
            avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
        },
        title: "好书",
        content: "这是一本好书",
        rating: 5,
        created_at: "2021-01-01",
        likes: 10,
        dislikes: 2,
    },
    {
        id: "2",
        user: {
            id: "2",
            name: "李四",
            avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
        },
        title: "好书",
        content:
            "读这本书的时候，文字以更舒缓的节奏停留在纸页上，让我得以随着自己的速度向前走。相比精简过的电影，文字的语言更柔和（简短句较少，不知道是原文的风格还是翻译的风格），增添了很多故事情节和主角的心理活动。于是主角变得比电影更生动。印象中电影前半段的主角较为冷情，对作为证人出席的性侵案受害者共感也少。书中的主角则有被撼动的一刻。\"律师应该在不知道真相的情况下辩护\"这个方针，电影主角给我的感觉是，因为这样对工作更方便所以选择，书的主角则思考过更多，她更有人文关怀，决定遵循这个原则也是因为法律体系就是这样运转，在这个规则里她应当扮演这样的角色。她思考过何为正义，也拥护正义，并认为正义应该由整个法律体系给出。",
        rating: 4,
        created_at: "2021-01-01",
        likes: 10,
        dislikes: 2,
    },
    {
        id: "3",
        user: {
            id: "3",
            name: "王五",
            avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
        },
        title: "好书",
        content:
            "This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.This book was absolutely amazing! The character development was incredible and the plot kept me engaged from start to finish. I would highly recommend it to anyone who enjoys this genre.",
        rating: 3,
        created_at: "2021-01-01",
        likes: 10,
        dislikes: 2,
    },
    {
        id: "4",
        user: {
            id: "4",
            name: "赵六",
            avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
        },
        title: "好书",
        content:
            "的确，没有剧版那样浓烈的情绪铺天盖地的。但因为是可以停顿下来的字里行间，所以，也再次看到了更多的细节。还有一个结尾处，没有被放进剧版里的，关于女记者的又一个三分之一，也很动人。",
        rating: 3.5,
        created_at: "2021-01-01",
        likes: 10,
        dislikes: 2,
    },
];
