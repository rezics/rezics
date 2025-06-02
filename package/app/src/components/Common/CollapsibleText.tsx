import React, { useMemo } from 'react';
import { Box, Link, useTheme } from '@mui/material';
import { proxy, useSnapshot } from "valtio";

interface CollapsibleTextProps {
    content: string;
    threshold?: number;
}

const state = proxy({ isExpanded: false });

export const CollapsibleText: React.FC<CollapsibleTextProps> = ({
    content,
    threshold = 200
}) => {
    const theme = useTheme();
    const snap = useSnapshot(state);

    const truncatedContent = useMemo(() => {
        return content.length > threshold
            ? content.slice(0, threshold)
            : content;
    }, [content, threshold]);

    const toggle = () => {
        state.isExpanded = !state.isExpanded;
    };

    return (
        <Box sx={{ position: 'relative' }}>
            <Box>
                {snap.isExpanded ? content : truncatedContent}
                {content.length > threshold && (
                    <>
                        {!snap.isExpanded && '…'}
                        {' '}
                        <Link
                            component="button"
                            onClick={toggle}
                            sx={{
                                fontSize: '0.875rem',
                                color: theme.palette.primary.main,
                                textDecoration: 'none',
                                '&:hover': {
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                },
                                transition: 'color 0.2s',
                            }}
                        >
                            {snap.isExpanded ? '收起' : '展開'}
                        </Link>
                    </>
                )}
            </Box>
        </Box>
    );
};