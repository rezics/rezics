import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import { proxy, useSnapshot } from 'valtio';

interface TagGroupObject {
    key: string;
    name: string;
    tags: string[];
}

interface BookTagProps {
    tagObjects?: TagGroupObject[];
}

const state = proxy({
    tagObjects: [] as TagGroupObject[],
});

export const BookTag: React.FC<BookTagProps> = ({ tagObjects: propTagObjects }) => {

    state.tagObjects = propTagObjects || [
        {
            key: 'tag1',
            name: 'User',
            tags: ["奇幻", "冒险", "平行世界"],
        },
        {
            key: 'tag2',
            name: 'AI',
            tags: ['标签2-1', '标签2-2', '标签2-3'],
        },
    ];

    const snap = useSnapshot(state);

    return (
        <Box>
            {snap.tagObjects.map((tagObject) => (
                <Box key={tagObject.key} sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight="bold">
                        {tagObject.name}
                    </Typography>
                    <Stack 
                        direction="row" 
                        spacing={1} 
                        sx={{ 
                            mt: 2,
                            flexWrap: 'wrap',
                            gap: 1
                        }}
                    >
                        {tagObject.tags.map((tag) => (
                            <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                sx={{
                                    bgcolor: 'grey.100',
                                    color: 'primary.main',
                                    '&:hover': {
                                        bgcolor: 'grey.200',
                                    },
                                }}
                            />
                        ))}
                    </Stack>
                </Box>
            ))}
        </Box>
    );
};
