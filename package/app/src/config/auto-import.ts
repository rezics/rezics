import AutoImport from 'unplugin-auto-import/vite';

export const autoImportPlugin = AutoImport({
    imports: [
      'react', 
      {
        '@mui/material': [
          // Layout
          'Box',
          'Container',
          'Grid',
          'Stack',
          'ImageList',
          // Inputs
          'Button',
          'IconButton',
          'TextField',
          'Select',
          'MenuItem',
          'Checkbox',
          'Radio',
          'RadioGroup',
          'FormControlLabel',
          'Switch',
          'Slider',
          'Autocomplete',
          // Navigation
          'AppBar',
          'Toolbar',
          'Drawer',
          'List',
          'ListItem',
          'ListItemButton',
          'ListItemIcon',
          'ListItemText',
          'Collapse',
          'Menu',
          'Tabs',
          'Tab',
          'BottomNavigation',
          'BottomNavigationAction',
          'Breadcrumbs',
          'Link',
          // Surfaces
          'Paper',
          'Card',
          'CardContent',
          'CardActions',
          'CardHeader',
          'Accordion',
          'AccordionSummary',
          'AccordionDetails',
          // Data Display
          'Avatar',
          'Badge',
          'Chip',
          'Divider',
          'Tooltip',
          'Typography',
          'Table',
          'TableBody',
          'TableCell',
          'TableContainer',
          'TableHead',
          'TableRow',
          'TablePagination',
          // Feedback
          'Alert',
          'CircularProgress',
          'LinearProgress',
          'Dialog',
          'DialogTitle',
          'DialogContent',
          'DialogActions',
          'Snackbar',
          'Skeleton',
          // Utils
          'CssBaseline',
          'ThemeProvider',
          'StyledEngineProvider',
          'useMediaQuery',
          'styled',
          'useTheme',
        ],
        '@mui/icons-material': [
          // Common Icons - Add more as needed
          // Generic
          'Menu','Close','Search','Add','Edit','Delete','Save','Info','Warning','Error',
          'Success','MoreVert','Visibility','VisibilityOff','Refresh','Check','Cancel',
          'Settings','AccountCircle','Home','Star','Favorite','Download','Upload','ContentCopy',
          'OpenInNew','Link'/*'LinkOff'*/,'FilterList','Sort',
          // Navigation
          'ArrowBack','ArrowForward','ArrowDropDown','ArrowDropUp','ChevronLeft','ChevronRight',
          'ExpandMore','ExpandLess','UnfoldMore','UnfoldLess','FirstPage','LastPage',
          'Fullscreen','FullscreenExit',
          // Toggle
          'CheckBoxOutlineBlank','CheckBox','RadioButtonUnchecked','RadioButtonChecked',
          // Action
          'Done','Schedule','Today','CalendarMonth','Event','Print','Share','Send','Email',
          'Phone','Place','LocationOn', // Duplicate of Place
          // Social
          'Person','Group','People','PersonAdd','ThumbUp','ThumbDown',
          // Content
          'FileCopy', // Duplicate of ContentCopy
          'Create', // Similar to Edit
          'Remove', // Similar to Delete or a minus icon
          'AddCircleOutline', 'RemoveCircleOutline',
          // Specific to your MainLayout (examples)
          'Brightness4', // For DarkModeIcon
          'Brightness7', // For LightModeIcon
          // Add more icons as you use them, this is just a larger starter set
        ],
      },
    ],
    dts: './src/auto-imports.d.ts',
    eslintrc: {
      enabled: true,
      filepath: './.eslintrc-auto-import.json',
      globalsPropValue: true,
    },
  }); 